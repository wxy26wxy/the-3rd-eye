import XCTest
@testable import The3rdEye

/// Round 4 (T141): the frame is set on the device and only the crop is uploaded
/// (`POST /artworks {framed: true}`); Your cutout works on the stored crop.
@MainActor
final class RoundFourTests: XCTestCase {
  private let base = URL(string: "http://localhost:3000/api/v1")!

  private func image(width: Int, height: Int, orientation: UIImage.Orientation = .up) -> UIImage {
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let drawn = UIGraphicsImageRenderer(size: CGSize(width: width, height: height), format: format).image { context in
      UIColor.red.setFill()
      context.fill(CGRect(x: 0, y: 0, width: width / 2, height: height))
      UIColor.blue.setFill()
      context.fill(CGRect(x: width / 2, y: 0, width: width - width / 2, height: height))
    }
    return UIImage(cgImage: drawn.cgImage!, scale: 1, orientation: orientation)
  }

  // MARK: Crop on the device

  func testCropIsTheFrameInPhotoPixels() throws {
    let photo = image(width: 400, height: 300)
    let crop = try XCTUnwrap(ImageTools.crop(photo, to: [100, 50, 300.4, 250]))
    XCTAssertEqual(crop.cgImage?.width, 201, "rounded outwards")
    XCTAssertEqual(crop.cgImage?.height, 200)
    XCTAssertEqual(crop.imageOrientation, .up)
  }

  func testCropIsClampedToThePhoto() throws {
    let crop = try XCTUnwrap(ImageTools.crop(image(width: 100, height: 80), to: [50, 40, 500, 500]))
    XCTAssertEqual(crop.cgImage?.width, 50)
    XCTAssertEqual(crop.cgImage?.height, 40)
    XCTAssertNil(ImageTools.crop(image(width: 100, height: 80), to: [200, 200, 300, 300]), "outside the photo")
    XCTAssertNil(ImageTools.crop(image(width: 100, height: 80), to: [1, 2, 3]))
  }

  /// A photo whose pixels are stored sideways (EXIF orientation) is turned upright first, so the
  /// frame means what the creator saw.
  func testCropAppliesTheOrientationFirst() throws {
    let sideways = image(width: 300, height: 200, orientation: .right)
    XCTAssertEqual(sideways.size, CGSize(width: 200, height: 300), "shown upright")
    let crop = try XCTUnwrap(ImageTools.crop(sideways, to: [0, 0, 200, 150]))
    XCTAssertEqual(crop.cgImage?.width, 200)
    XCTAssertEqual(crop.cgImage?.height, 150)
  }

  // MARK: The framed upload

  func testPhotoArtworkIsSentFramedWithoutDetect() async throws {
    BackgroundWork.host = RecordingBackgroundHost()
    let body = #"{"artwork":{"id":"p1","cleanedUrl":"https://x/c.png"},"candidates":[{"id":"c1","bbox":[0,0,10,10]}],"imageSize":{"w":800,"h":600}}"#
    let stub = StubTransport(status: 201, body: body)
    let api = APIClient(baseURL: base, transport: stub, token: "t0k")
    let res = try await api.artworkFromPhoto(imageUrl: "https://blob.example/creators/c1/photos/a.jpg", product: .tote)
    let sent = try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(stub.requests.first?.httpBody)) as? [String: Any])
    XCTAssertEqual(sent["framed"] as? Bool, true)
    XCTAssertNil(sent["detect"], "never detect:false with framed (400)")
    XCTAssertEqual(sent["source"] as? String, "photo")
    XCTAssertEqual(sent["product"] as? String, "tote")
    XCTAssertEqual(res.imageSize, ImageSize(w: 800, h: 600))
  }

  func testNothingInTheCropIsNoDrawingFoundWithTheRow() async {
    BackgroundWork.host = RecordingBackgroundHost()
    let stub = StubTransport(status: 422, body: #"{"error":{"code":"no_drawing_found","message":"none","artworkId":"p7"}}"#)
    let api = APIClient(baseURL: base, transport: stub, token: "t0k")
    do {
      _ = try await api.artworkFromPhoto(imageUrl: "u", product: .sticker)
      XCTFail("expected 422")
    } catch let none as NoDrawingFound {
      XCTAssertEqual(none.artworkId, "p7")
    } catch {
      XCTFail("unexpected \(error)")
    }
  }

  // MARK: Recovery of a lost answer

  private let started = ISO8601DateFormatter().date(from: "2026-11-03T10:00:00Z")!

  func testRecoveredPhotoIsTheNewestPhotoRowMadeAfterTheJobStarted() {
    let job = PendingJob(kind: .photo(box: [0, 0, 10, 10]), startedAt: started, clientRequestId: "r1", knownArtworkIds: ["known"])
    let rows = [
      Artwork(id: "old", source: "photo", createdAt: "2026-11-03T09:00:00.000Z"),
      Artwork(id: "known", source: "photo", createdAt: "2026-11-03T10:00:10.000Z"),
      Artwork(id: "change", source: "photo", parentArtworkId: "p1", changeInstruction: "x", createdAt: "2026-11-03T10:00:20.000Z"),
      Artwork(id: "new", source: "photo", createdAt: "2026-11-03T10:00:15.000Z"),
    ]
    XCTAssertEqual(CreateFlow.recoveredPhoto(in: rows, job: job)?.id, "new")
    XCTAssertNil(CreateFlow.recoveredPhoto(in: Array(rows.prefix(3)), job: job), "nothing new")
  }

  func testAPhotoJobKeepsItsIdForTheSameFrameOnly() {
    let flow = CreateFlow()
    let first = flow.startJob(.photo(box: [0, 0, 10, 10]))
    XCTAssertEqual(flow.startJob(.photo(box: [0, 0, 10, 10])), first, "Try again: the same job")
    flow.finishJob(first)
    XCTAssertNotEqual(flow.startJob(.photo(box: [0, 0, 5, 5])).clientRequestId, first.clientRequestId)
  }

  func testANewPhotoDropsTheFrameAndTheUpload() {
    let flow = CreateFlow()
    flow.areaBox = [0, 0, 5, 5]
    flow.cropUpload = CropUpload(box: [0, 0, 5, 5], url: "u")
    flow.recordPhoto(PhotoArtworkResponse(artwork: Artwork(id: "p1", cleanedUrl: "c"), candidates: [], imageSize: nil), box: [0, 0, 5, 5])
    flow.discardPhoto()
    XCTAssertNil(flow.areaBox)
    XCTAssertNil(flow.cropUpload)
    XCTAssertNil(flow.cropBox)
    XCTAssertNil(flow.photoArtwork)
  }

  // MARK: Ruling 2: the product before Change it

  func testMakeProductCreatesOnceThenReuses() async throws {
    BackgroundWork.host = RecordingBackgroundHost()
    let stub = StubTransport(status: 201, body: #"{"id":"pr-new-sticker","artworkId":"p1","type":"sticker","mockupUrl":"https://x/m.png"}"#)
    let flow = CreateFlow()
    flow.productType = .sticker
    let piece = Artwork(id: "p1", cleanedUrl: "cut-1")
    let api = APIClient(baseURL: base, transport: stub, token: "t0k")
    let made = try await flow.makeProduct(for: piece, type: .sticker, api: api)
    XCTAssertEqual(made.mockupUrl, "https://x/m.png")
    XCTAssertEqual(stub.requests.map { $0.url?.path }, ["/api/v1/products"])
    let sent = try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(stub.requests[0].httpBody)) as? [String: Any])
    XCTAssertEqual(sent["artworkId"] as? String, "p1")
    XCTAssertNotNil(sent["clientRequestId"] as? String)
    XCTAssertNil(flow.pendingJob)
    _ = try await flow.makeProduct(for: piece, type: .sticker, api: api)
    XCTAssertEqual(stub.requests.count, 1, "the draft of this cut is reused: no second call")
  }

  func testMakeProductKeepsTheRequestIdForTryAgainAfterALostAnswer() async {
    BackgroundWork.host = RecordingBackgroundHost()
    let flow = CreateFlow()
    let piece = Artwork(id: "p1", cleanedUrl: "cut-1")
    final class Failing: HTTPTransport, @unchecked Sendable {
      var bodies: [Data] = []
      func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        if let body = request.httpBody { bodies.append(body) }
        throw URLError(.networkConnectionLost)
      }
    }
    let transport = Failing()
    let api = APIClient(baseURL: base, transport: transport, token: "t0k")
    _ = try? await flow.makeProduct(for: piece, type: .sticker, api: api)
    let job = flow.pendingJob
    XCTAssertNotNil(job, "kept for Try again")
    _ = try? await flow.makeProduct(for: piece, type: .sticker, api: api)
    XCTAssertEqual(flow.pendingJob?.clientRequestId, job?.clientRequestId, "Try again sends the same id")
  }

  func testContinueFromADesignWithoutADraftOpensChangeIt() {
    let app = AppState(api: APIClient(baseURL: base, transport: StubTransport(body: "{}"), token: "t"))
    app.continueFrom(artwork: Artwork(id: "d1", cleanedUrl: "c", products: [ArtworkProduct(id: "live", type: .sticker, status: "published")]),
                     productType: .sticker)
    XCTAssertEqual(app.createPath, [.changeIt], "Change it in the making state")
    XCTAssertEqual(app.flow.currentCut?.id, "d1")
    XCTAssertNil(app.flow.readyProduct(for: app.flow.currentCut))
    app.continueFrom(artwork: Artwork(id: "d2", cleanedUrl: "c", products: [ArtworkProduct(id: "draft", type: .sticker, status: "draft")]),
                     productType: .sticker)
    XCTAssertEqual(app.createPath, [.listingDetails], "a draft goes on to its listing")
    XCTAssertEqual(app.flow.product?.id, "draft")
    XCTAssertEqual(app.flow.readyProduct(for: app.flow.currentCut)?.id, "draft")
  }

  /// Listing "Redo" → Your cutout → "Use this" → Change it (its product kept, no new one).
  func testRedoFromTheListingComesBackToChangeIt() {
    let app = AppState(api: APIClient(baseURL: base, transport: StubTransport(body: "{}"), token: "t"))
    let flow = app.flow
    flow.productType = .sticker
    flow.photo = UIGraphicsImageRenderer(size: CGSize(width: 4, height: 4)).image { _ in }
    flow.recordPhoto(PhotoArtworkResponse(artwork: Artwork(id: "p1", cleanedUrl: "c"), candidates: [], imageSize: nil), box: [0, 0, 4, 4])
    flow.useProduct(Product(id: "pr1", artworkId: "p1", type: .sticker), madeFrom: Artwork(id: "p1", cleanedUrl: "c"))
    XCTAssertEqual(flow.routeAfterLooksGood(), .listingDetails)
    app.createPath = [.chooseMethod, .adjustArea, .yourCutout("p1"), .changeIt, .listingDetails]
    app.backToCutout()
    XCTAssertEqual(app.createPath.last, .yourCutout("p1"))
    XCTAssertEqual(flow.routeAfterCutout(of: "p1"), .changeIt)
    XCTAssertEqual(flow.readyProduct(for: flow.currentCut)?.id, "pr1", "the photo shows at once")
  }

  func testCleanupAndCutoutAnswersCarryProducts() throws {
    let cleanup = #"{"id":"p1","cleanedUrl":"c2","details":{"failedProductIds":[]},"products":[{"id":"pr1","type":"sticker","status":"draft","priceCents":500,"title":null,"description":null,"mockupUrl":"m2","previewUrl":"v2"}]}"#
    let res = try JSONDecoder().decode(CleanupResult.self, from: Data(cleanup.utf8))
    XCTAssertEqual(res.products.first?.mockupUrl, "m2")
    XCTAssertNil(res.artwork.products, "the answer's products are not the artwork's list")
    let cut = #"{"artwork":{"id":"ch1","cleanedUrl":"c"},"candidates":[],"imageSize":{"w":1,"h":1},"products":[]}"#
    XCTAssertEqual(try JSONDecoder().decode(CutoutResponse.self, from: Data(cut.utf8)).products, [])
    let old = #"{"id":"p1","cleanedUrl":"c2"}"#
    XCTAssertEqual(try JSONDecoder().decode(CleanupResult.self, from: Data(old.utf8)).products, [], "older servers")
  }
}
