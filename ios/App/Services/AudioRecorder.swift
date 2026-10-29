import AVFoundation
import Observation

/// AAC (.m4a) recorder for voice input. Max 60 s to stay within /transcribe limits.
@MainActor
@Observable
final class AudioRecorder {
  enum RecorderError: LocalizedError {
    case permissionDenied
    var errorDescription: String? {
      String(localized: "Microphone access is off. You can turn it on in Settings, or type instead.")
    }
  }

  private var recorder: AVAudioRecorder?
  private(set) var isRecording = false
  private(set) var level: Float = 0
  private var meterTask: Task<Void, Never>?
  let maxDuration: TimeInterval

  init(maxDuration: TimeInterval = 60) {
    self.maxDuration = maxDuration
  }

  func start() async throws {
    let granted = await AVAudioApplication.requestRecordPermission()
    guard granted else { throw RecorderError.permissionDenied }
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
    try session.setActive(true)
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("voice-\(UUID().uuidString).m4a")
    let settings: [String: Any] = [
      AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
      AVSampleRateKey: 44_100,
      AVNumberOfChannelsKey: 1,
      AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
    ]
    let recorder = try AVAudioRecorder(url: url, settings: settings)
    recorder.isMeteringEnabled = true
    recorder.record(forDuration: maxDuration)
    self.recorder = recorder
    isRecording = true
    meterTask = Task { [weak self] in
      while !Task.isCancelled {
        guard let self, let r = self.recorder else { return }
        r.updateMeters()
        self.level = max(0, (r.averagePower(forChannel: 0) + 50) / 50)
        if !r.isRecording { self.isRecording = false }
        try? await Task.sleep(for: .milliseconds(100))
      }
    }
  }

  /// Stops and returns the file, or nil if nothing was recorded.
  func stop() -> URL? {
    meterTask?.cancel()
    meterTask = nil
    guard let recorder else { return nil }
    recorder.stop()
    isRecording = false
    level = 0
    self.recorder = nil
    return recorder.url
  }

  func cancel() {
    if let url = stop() { try? FileManager.default.removeItem(at: url) }
  }
}
