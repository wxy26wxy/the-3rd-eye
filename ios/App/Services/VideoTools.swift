import AVFoundation
import os

/// Video helpers for the story and thank-you videos: length cap and soundtrack
/// extraction. Captions are made on the server from a WAV of the soundtrack
/// (Muse Voice Transcribe accepts WAV only and Vercel has no ffmpeg).
enum VideoTools {
  enum VideoError: LocalizedError {
    case noAudioTrack
    case readFailed(String)
    case exportFailed

    var errorDescription: String? {
      switch self {
      case .noAudioTrack: return String(localized: "This video has no sound, so it won't have captions.")
      case .readFailed, .exportFailed: return String(localized: "That video couldn't be opened. Try another one.")
      }
    }
  }

  static let wavSampleRate = 16_000
  static let wavChannels = 1
  static let wavBitsPerSample = 16
  /// Small allowance so a 30.2 s camera clip is not trimmed.
  static let lengthTolerance: Double = 0.5

  private static let log = Logger(subsystem: "com.the3rdeye.app", category: "video")

  static func duration(of url: URL) async throws -> Double {
    let seconds = try await AVURLAsset(url: url).load(.duration).seconds
    return seconds.isFinite ? seconds : 0
  }

  /// Returns the video unchanged when it fits `maxSeconds`, otherwise a copy of
  /// its first `maxSeconds` (library videos skip the camera's length limit).
  static func capped(_ url: URL, maxSeconds: Double) async throws -> (url: URL, trimmed: Bool) {
    let seconds = try await duration(of: url)
    guard seconds > maxSeconds + lengthTolerance else { return (url, false) }
    let asset = AVURLAsset(url: url)
    guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetPassthrough) else {
      throw VideoError.exportFailed
    }
    let out = FileManager.default.temporaryDirectory.appendingPathComponent("trim-\(UUID().uuidString).mov")
    session.timeRange = CMTimeRange(start: .zero, duration: CMTime(seconds: maxSeconds, preferredTimescale: 600))
    if #available(iOS 18, *) {
      try await session.export(to: out, as: .mov)
    } else {
      session.outputURL = out
      session.outputFileType = .mov
      await session.export()
      guard session.status == .completed else {
        log.error("trim failed: \(session.error?.localizedDescription ?? "unknown", privacy: .public)")
        throw VideoError.exportFailed
      }
    }
    log.debug("trimmed \(seconds, privacy: .public) s video to \(maxSeconds, privacy: .public) s")
    return (out, true)
  }

  /// Reads the first audio track (at most `maxSeconds`, never past the video's end)
  /// and writes it as a 16 kHz mono 16-bit little-endian PCM WAV file.
  ///
  /// `AVAudioConverter` does the downmix and resampling. A PCM soundtrack is read
  /// as stored (no decoding); a compressed one (AAC from the camera) is decoded by
  /// the reader to float PCM at its own rate. The reader's decode path builds an
  /// offline AudioQueue that talks to the audio server; in the simulator that
  /// server is unreliable and the call can stall (seen: 15 s to many minutes), so
  /// unit tests use a PCM source and the AAC path is checked on a device.
  static func extractSoundtrackWAV(from url: URL, maxSeconds: Double) async throws -> URL {
    let asset = AVURLAsset(url: url)
    guard let track = try await asset.loadTracks(withMediaType: .audio).first else { throw VideoError.noAudioTrack }
    let length = try await asset.load(.duration)
    let cap = CMTime(seconds: maxSeconds, preferredTimescale: 600)
    let reader = try AVAssetReader(asset: asset)
    reader.timeRange = CMTimeRange(start: .zero, duration: CMTimeMinimum(length, cap))
    let stored = try await track.load(.formatDescriptions).first.flatMap { CMAudioFormatDescriptionGetStreamBasicDescription($0)?.pointee }
    let isPCM = stored?.mFormatID == kAudioFormatLinearPCM
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: isPCM ? nil : [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVLinearPCMBitDepthKey: 32,
      AVLinearPCMIsFloatKey: true,
      AVLinearPCMIsBigEndianKey: false,
      AVLinearPCMIsNonInterleaved: false,
    ])
    guard reader.canAdd(output) else { throw VideoError.readFailed("cannot add output") }
    reader.add(output)
    guard reader.startReading() else { throw VideoError.readFailed(reader.error?.localizedDescription ?? "start") }

    guard let target = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: Double(wavSampleRate), channels: AVAudioChannelCount(wavChannels), interleaved: true) else {
      throw VideoError.readFailed("target format")
    }
    let maxBytes = Int(maxSeconds) * wavSampleRate * wavChannels * wavBitsPerSample / 8
    var pcm = Data()
    pcm.reserveCapacity(maxBytes)
    var converter: AVAudioConverter?

    func append(_ buffer: AVAudioPCMBuffer) {
      guard buffer.frameLength > 0, let ch = buffer.int16ChannelData else { return }
      pcm.append(Data(bytes: ch[0], count: Int(buffer.frameLength) * wavChannels * 2))
    }

    while let sample = output.copyNextSampleBuffer() {
      guard let input = pcmBuffer(from: sample) else { continue }
      if converter == nil { converter = AVAudioConverter(from: input.format, to: target) }
      guard let converter else { throw VideoError.readFailed("converter") }
      let capacity = AVAudioFrameCount(Double(input.frameLength) * target.sampleRate / input.format.sampleRate) + 1024
      guard let out = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: capacity) else { continue }
      var fed = false
      var convError: NSError?
      _ = converter.convert(to: out, error: &convError) { _, status in
        if fed { status.pointee = .noDataNow; return nil }
        fed = true
        status.pointee = .haveData
        return input
      }
      if let convError { throw VideoError.readFailed(convError.localizedDescription) }
      append(out)
    }
    if reader.status == .failed { throw VideoError.readFailed(reader.error?.localizedDescription ?? "read") }
    // Flush what the resampler still holds.
    if let converter, let out = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: 4096) {
      _ = converter.convert(to: out, error: nil) { _, status in status.pointee = .endOfStream; return nil }
      append(out)
    }
    // Whole frames only, and never more than the cap.
    let frameBytes = wavChannels * wavBitsPerSample / 8
    let usable = min(pcm.count, maxBytes) / frameBytes * frameBytes
    if usable < pcm.count { pcm = pcm.prefix(usable) }

    var file = wavHeader(pcmByteCount: pcm.count, sampleRate: wavSampleRate, channels: wavChannels, bitsPerSample: wavBitsPerSample)
    file.append(pcm)
    let out = FileManager.default.temporaryDirectory.appendingPathComponent("soundtrack-\(UUID().uuidString).wav")
    try file.write(to: out)
    log.debug("soundtrack wav: \(file.count, privacy: .public) bytes")
    return out
  }

  /// Copies a PCM sample buffer (as stored, or decoded by the reader) into an AVAudioPCMBuffer.
  private static func pcmBuffer(from sample: CMSampleBuffer) -> AVAudioPCMBuffer? {
    guard let description = CMSampleBufferGetFormatDescription(sample),
          let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(description),
          let format = AVAudioFormat(streamDescription: asbd) else { return nil }
    let frames = AVAudioFrameCount(CMSampleBufferGetNumSamples(sample))
    guard frames > 0, let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames) else { return nil }
    buffer.frameLength = frames
    let status = CMSampleBufferCopyPCMDataIntoAudioBufferList(sample, at: 0, frameCount: Int32(frames), into: buffer.mutableAudioBufferList)
    return status == noErr ? buffer : nil
  }

  /// 44-byte canonical RIFF/WAVE header for integer PCM.
  static func wavHeader(pcmByteCount: Int, sampleRate: Int, channels: Int, bitsPerSample: Int) -> Data {
    var d = Data()
    func ascii(_ s: String) { d.append(contentsOf: Array(s.utf8)) }
    func u32(_ v: Int) { withUnsafeBytes(of: UInt32(v).littleEndian) { d.append(contentsOf: $0) } }
    func u16(_ v: Int) { withUnsafeBytes(of: UInt16(v).littleEndian) { d.append(contentsOf: $0) } }
    let blockAlign = channels * bitsPerSample / 8
    ascii("RIFF"); u32(36 + pcmByteCount); ascii("WAVE")
    ascii("fmt "); u32(16); u16(1); u16(channels); u32(sampleRate); u32(sampleRate * blockAlign); u16(blockAlign); u16(bitsPerSample)
    ascii("data"); u32(pcmByteCount)
    return d
  }
}

/// Uploads a recorded or picked video plus a WAV of its soundtrack (for captions).
struct VideoUpload {
  struct Result: Equatable {
    let videoPathname: String
    /// Nil when the video has no sound or extraction failed; the video is still sent.
    let audioPathname: String?
    let trimmed: Bool
  }

  let api: APIClient
  var uploader: BlobUploader { BlobUploader(api: api) }
  private static let log = Logger(subsystem: "com.the3rdeye.app", category: "video")

  func upload(_ picked: URL, creatorId: String, kind: BlobUploader.Kind, maxSeconds: Double) async throws -> Result {
    let (video, trimmed) = try await VideoTools.capped(picked, maxSeconds: maxSeconds)
    let ext = video.pathExtension.lowercased() == "mp4" ? "mp4" : "mov"
    let data = try Data(contentsOf: video)
    let uploaded = try await uploader.upload(
      data, creatorId: creatorId, kind: kind,
      contentType: ext == "mp4" ? "video/mp4" : "video/quicktime", fileExtension: ext)

    var audioPathname: String?
    do {
      let wav = try await VideoTools.extractSoundtrackWAV(from: video, maxSeconds: maxSeconds)
      defer { try? FileManager.default.removeItem(at: wav) }
      let audio = try await uploader.upload(Data(contentsOf: wav), creatorId: creatorId, kind: .audio, contentType: "audio/wav", fileExtension: "wav")
      audioPathname = audio.pathname
    } catch is CancellationError {
      throw CancellationError()
    } catch {
      // Captions are best effort; the video itself is what the buyer needs.
      Self.log.warning("soundtrack not sent: \(error.localizedDescription, privacy: .public)")
    }
    if trimmed { try? FileManager.default.removeItem(at: video) }
    return Result(videoPathname: uploaded.pathname, audioPathname: audioPathname, trimmed: trimmed)
  }
}
