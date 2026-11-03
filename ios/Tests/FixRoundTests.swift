import XCTest
@testable import The3rdEye

@MainActor
final class FixRoundTests: XCTestCase {
  private let base = URL(string: "http://localhost:3000/api/v1")!

  func testReplaceTopSwapsTheLoadingScreen() {
    let app = AppState(api: APIClient(baseURL: base, transport: StubTransport(body: "{}"), token: nil))
    app.push(.changeIt)
    app.push(.changing)
    app.replaceTop(with: .beforeAfter)
    XCTAssertEqual(app.createPath, [.changeIt, .beforeAfter], "Back from Before and after skips Changing your art")
    app.push(.makingCutout(.change("ch1")))
    app.replaceTop(with: .yourCutout("ch1"))
    app.push(.makingProduct)
    app.replaceTop(with: .listingDetails)
    XCTAssertEqual(app.createPath, [.changeIt, .beforeAfter, .yourCutout("ch1"), .listingDetails], "no loading screen is left behind")
  }

  func testOrdersResetClearsPreviousAccount() {
    let store = OrdersStore(api: APIClient(baseURL: base, transport: StubTransport(body: "{}"), token: nil))
    store.merge([OrderSummary(id: "a", createdAt: "2026-10-28T10:00:00Z", unreadMessages: 2)], replacing: true)
    XCTAssertFalse(store.orders.isEmpty)
    store.reset()
    XCTAssertTrue(store.orders.isEmpty)
    XCTAssertEqual(store.unread, 0)
    XCTAssertFalse(store.loaded)
  }

  func testVideoUploadsArePrivate() async throws {
    let api = APIClient(baseURL: base, transport: StubTransport(body: #"{"clientToken":"vercel_blob_client_s1_x"}"#), token: "t")
    let blob = StubTransport(body: #"{"url":"https://x/v.mov","pathname":"creators/c1/story-video/v.mov"}"#)
    _ = try await BlobUploader(api: api, transport: blob).upload(Data([1]), creatorId: "c1", kind: .storyVideo, contentType: "video/quicktime", fileExtension: "mov")
    XCTAssertEqual(blob.requests.count, 1)
    XCTAssertEqual(blob.requests[0].value(forHTTPHeaderField: "x-vercel-blob-access"), "private")
  }

  func testPrivateRefusedFallsBackToPublic() async throws {
    let api = APIClient(baseURL: base, transport: StubTransport(body: #"{"clientToken":"vercel_blob_client_s1_x"}"#), token: "t")
    let blob = StubTransport(body: #"{"url":"https://x/v.mov","pathname":"creators/c1/thank-you-videos/v.mov"}"#)
    blob.queue = [(403, #"{"error":{"code":"forbidden","message":"store is public"}}"#)]
    let result = try await BlobUploader(api: api, transport: blob).upload(Data([1]), creatorId: "c1", kind: .thankYouVideo, contentType: "video/quicktime", fileExtension: "mov")
    XCTAssertEqual(result.pathname, "creators/c1/thank-you-videos/v.mov")
    XCTAssertEqual(blob.requests.map { $0.value(forHTTPHeaderField: "x-vercel-blob-access") }, ["private", "public"])
  }

  func testPhotoUploadsArePublicWithoutRetry() async throws {
    let api = APIClient(baseURL: base, transport: StubTransport(body: #"{"clientToken":"vercel_blob_client_s1_x"}"#), token: "t")
    let blob = StubTransport(status: 403, body: "denied")
    do {
      _ = try await BlobUploader(api: api, transport: blob).upload(Data([1]), creatorId: "c1", kind: .photo, contentType: "image/jpeg", fileExtension: "jpg")
      XCTFail("expected error")
    } catch {
      XCTAssertEqual(blob.requests.count, 1)
      XCTAssertEqual(blob.requests[0].value(forHTTPHeaderField: "x-vercel-blob-access"), "public")
    }
  }

  func testTranscriberSendsWav() async throws {
    let stub = StubTransport(body: #"{"text":" hello "}"#)
    let api = APIClient(baseURL: base, transport: stub, token: "t")
    let file = FileManager.default.temporaryDirectory.appendingPathComponent("t-\(UUID().uuidString).wav")
    try Data([0, 1, 2, 3]).write(to: file)
    let text = try await Transcriber(api: api).transcribe(fileURL: file)
    XCTAssertEqual(text, "hello")
    let req = try XCTUnwrap(stub.requests.first)
    XCTAssertEqual(req.url?.path, "/api/v1/transcribe")
    XCTAssertTrue(req.value(forHTTPHeaderField: "Content-Type")?.hasPrefix("multipart/form-data; boundary=") ?? false)
    let body = String(decoding: req.httpBody ?? Data(), as: UTF8.self)
    XCTAssertTrue(body.contains("name=\"file\"; filename=\"audio.wav\""))
    XCTAssertTrue(body.contains("Content-Type: audio/wav"))
  }
}
