import AVFoundation
import XCTest
@testable import The3rdEye

final class VideoToolsTests: XCTestCase {
  /// Writes `seconds` of a 440 Hz tone as 44.1 kHz stereo 16-bit PCM (a phone video's
  /// soundtrack rate and layout). Written by hand: encoding through AudioToolbox in the
  /// simulator can stall for minutes waiting on the audio server.
  private func makeTone(seconds: Double) throws -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("tone-\(UUID().uuidString).wav")
    let frames = Int(seconds * 44_100)
    var pcm = Data(capacity: frames * 4)
    for i in 0..<frames {
      let v = Int16(sin(2 * Double.pi * 440 * Double(i) / 44_100) * 16_000)
      withUnsafeBytes(of: v.littleEndian) { pcm.append(contentsOf: $0); pcm.append(contentsOf: $0) }
    }
    var file = VideoTools.wavHeader(pcmByteCount: pcm.count, sampleRate: 44_100, channels: 2, bitsPerSample: 16)
    file.append(pcm)
    try file.write(to: url)
    return url
  }

  private func u32(_ d: Data, _ at: Int) -> Int { Int(d.subdata(in: at..<at + 4).withUnsafeBytes { $0.loadUnaligned(as: UInt32.self) }.littleEndian) }
  private func u16(_ d: Data, _ at: Int) -> Int { Int(d.subdata(in: at..<at + 2).withUnsafeBytes { $0.loadUnaligned(as: UInt16.self) }.littleEndian) }
  private func ascii(_ d: Data, _ at: Int) -> String { String(decoding: d.subdata(in: at..<at + 4), as: UTF8.self) }

  func testSoundtrackOfOneSecondAssetIs16kMonoPCMWav() async throws {
    let tone = try makeTone(seconds: 1)
    let wavURL = try await VideoTools.extractSoundtrackWAV(from: tone, maxSeconds: 30)
    let wav = try Data(contentsOf: wavURL)
    XCTAssertEqual(ascii(wav, 0), "RIFF")
    XCTAssertEqual(u32(wav, 4), wav.count - 8, "RIFF size covers the whole file")
    XCTAssertEqual(ascii(wav, 8), "WAVE")
    XCTAssertEqual(ascii(wav, 12), "fmt ")
    XCTAssertEqual(u32(wav, 16), 16)
    XCTAssertEqual(u16(wav, 20), 1, "integer PCM")
    XCTAssertEqual(u16(wav, 22), 1, "mono")
    XCTAssertEqual(u32(wav, 24), 16_000)
    XCTAssertEqual(u32(wav, 28), 32_000, "byte rate")
    XCTAssertEqual(u16(wav, 32), 2, "block align")
    XCTAssertEqual(u16(wav, 34), 16)
    XCTAssertEqual(ascii(wav, 36), "data")
    let dataBytes = u32(wav, 40)
    XCTAssertEqual(dataBytes, wav.count - 44)
    XCTAssertEqual(Double(dataBytes), 32_000, accuracy: 32_000 * 0.06, "about one second of 16 kHz 16-bit mono")
    XCTAssertTrue(wav.subdata(in: 44..<wav.count).contains { $0 != 0 }, "the tone is not silence")
  }

  func testSoundtrackIsCappedAtTheLimit() async throws {
    let tone = try makeTone(seconds: 2)
    let wav = try Data(contentsOf: try await VideoTools.extractSoundtrackWAV(from: tone, maxSeconds: 1))
    XCTAssertLessThanOrEqual(u32(wav, 40), 32_000)
    XCTAssertGreaterThan(u32(wav, 40), 28_000)
  }

  func testHeaderLayout() {
    let header = VideoTools.wavHeader(pcmByteCount: 10, sampleRate: 16_000, channels: 1, bitsPerSample: 16)
    XCTAssertEqual(header.count, 44)
    XCTAssertEqual(u32(header, 4), 46)
    XCTAssertEqual(u32(header, 40), 10)
  }

  func testCaptionRequestsCarryAudioUrl() async throws {
    let base = URL(string: "http://localhost:3000/api/v1")!
    let stub = StubTransport(body: Fixtures.creator)
    let api = APIClient(baseURL: base, transport: stub, token: "t")
    _ = try await api.saveStoryVideo(pathname: "creators/c1/story-video/v.mov", audioPathname: "creators/c1/audio/a.wav", mentionDisability: false)
    var sent = try JSONSerialization.jsonObject(with: stub.requests[0].httpBody!) as? [String: Any]
    XCTAssertEqual(sent?["videoUrl"] as? String, "creators/c1/story-video/v.mov")
    XCTAssertEqual(sent?["audioUrl"] as? String, "creators/c1/audio/a.wav")
    XCTAssertGreaterThanOrEqual(stub.requests[0].timeoutInterval, 300)

    stub.body = #"{"id":"t1","orderId":"o1","text":null,"imageUrl":null,"videoUrl":"creators/c1/thank-you-videos/v.mov","createdAt":null}"#
    _ = try await api.sendThankYou(orderId: "o1", ThankYouRequest(videoUrl: "creators/c1/thank-you-videos/v.mov", audioUrl: "creators/c1/audio/b.wav"))
    sent = try JSONSerialization.jsonObject(with: stub.requests[1].httpBody!) as? [String: Any]
    XCTAssertEqual(sent?["audioUrl"] as? String, "creators/c1/audio/b.wav")
  }
}
