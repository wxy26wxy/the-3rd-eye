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
}
