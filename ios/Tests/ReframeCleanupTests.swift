import XCTest
@testable import The3rdEye

/// T146: a re-frame deletes the row it replaces (after the new row exists), a row that answered
/// `422 no_drawing_found` is deleted on the next "Use this area" or "Take a new photo", and My
/// designs hides such rows.
@MainActor
final class ReframeCleanupTests: XCTestCase {
  private let base = URL(string: "http://localhost:3000/api/v1")!

  private func api(_ stub: StubTransport) -> APIClient {
    APIClient(baseURL: base, transport: stub, token: "t0k")
  }

  private func deletes(_ stub: StubTransport) -> [String] {
    stub.requests.filter { $0.httpMethod == "DELETE" }.compactMap { $0.url?.lastPathComponent }
  }

  private func flowWithPiece(_ id: String = "p1") -> CreateFlow {
    let flow = CreateFlow()
    flow.photoArtwork = Artwork(id: id, cleanedUrl: "cut")
    flow.pieceArtwork = flow.photoArtwork
    return flow
  }

  private let okBody = #"{"id":"x","deleted":true,"archivedProductIds":[]}"#

  /// Nothing is deleted when the re-frame starts, nor when the create fails; the old row is only
  /// remembered. The delete goes out after the create succeeded.
  func testDeleteComesAfterTheNewRowExists() async {
    let stub = StubTransport(body: okBody)
    let client = api(stub)
    let flow = flowWithPiece("p1")
    flow.beginReframe()
    XCTAssertEqual(flow.supersedes, "p1")
    XCTAssertTrue(deletes(stub).isEmpty, "not before the new create")
    // A failed upload or create never reaches dropSuperseded: the old row stays and is still the one to replace.
    flow.beginReframe()
    XCTAssertEqual(flow.supersedes, "p1")
    XCTAssertTrue(deletes(stub).isEmpty)
    // The create succeeded with a new row.
    flow.recordPhoto(PhotoArtworkResponse(artwork: Artwork(id: "p2", cleanedUrl: "cut2"), candidates: [], imageSize: nil), box: [0, 0, 10, 10])
    await flow.dropSuperseded(except: "p2", api: client)?.value
    XCTAssertEqual(deletes(stub), ["p1"])
    XCTAssertNil(flow.supersedes)
    XCTAssertEqual(stub.requests.first?.url?.path, "/api/v1/artworks/p1")
  }

  func testTheNewRowItselfIsNeverDeleted() async {
    let stub = StubTransport(body: okBody)
    let flow = flowWithPiece("p1")
    flow.beginReframe()
    XCTAssertNil(flow.dropSuperseded(except: "p1", api: api(stub)))
    XCTAssertTrue(deletes(stub).isEmpty)
  }

  /// "Use this area" after a 422: the empty row goes, even for the same frame; the piece the
  /// re-frame began from goes once the next crop succeeds.
  func testEmptyRowIsDeletedOnTheNextUseThisArea() async {
    let stub = StubTransport(body: okBody)
    let client = api(stub)
    let flow = flowWithPiece("p1")
    flow.beginReframe()
    flow.emptyRowId = "p2"
    await flow.dropEmptyRow(api: client)?.value
    XCTAssertEqual(deletes(stub), ["p2"])
    XCTAssertNil(flow.emptyRowId)
    XCTAssertNil(flow.dropEmptyRow(api: client), "once")
    XCTAssertEqual(flow.supersedes, "p1", "the earlier piece waits for the next successful crop")
    flow.recordPhoto(PhotoArtworkResponse(artwork: Artwork(id: "p3", cleanedUrl: "c"), candidates: [], imageSize: nil), box: [0, 0, 5, 5])
    await flow.dropSuperseded(except: "p3", api: client)?.value
    XCTAssertEqual(deletes(stub), ["p2", "p1"])
  }

  /// A 200 answer without a cut leaves the photo on hand as the empty row; it is not also "superseded" twice.
  func testEmptyRowIsNotTakenAsTheRowToReplace() {
    let flow = CreateFlow()
    flow.photoArtwork = Artwork(id: "p2")
    flow.emptyRowId = "p2"
    flow.beginReframe()
    XCTAssertNil(flow.supersedes)
  }

  /// "Take a new photo": the empty row and the earlier piece row both go.
  func testTakeANewPhotoDeletesTheEmptyRowAndTheEarlierPiece() async {
    let stub = StubTransport(body: okBody)
    let flow = flowWithPiece("p1")
    flow.beginReframe()
    flow.emptyRowId = "p2"
    for task in flow.dropRowsOnRetake(api: api(stub)) { await task.value }
    XCTAssertEqual(Set(deletes(stub)), ["p1", "p2"])
    XCTAssertEqual(deletes(stub).count, 2)
    XCTAssertNil(flow.supersedes)
    XCTAssertNil(flow.emptyRowId)
    flow.discardPhoto()
    XCTAssertTrue(flow.dropRowsOnRetake(api: api(stub)).isEmpty)
  }

  /// A failed re-frame (no 422 row) keeps the earlier piece on Take a new photo / a new camera photo.
  func testRetakeWithoutAnEmptyRowKeepsTheEarlierPiece() async {
    let stub = StubTransport(body: okBody)
    let flow = flowWithPiece("p1")
    flow.beginReframe()
    XCTAssertTrue(flow.dropRowsOnRetake(api: api(stub)).isEmpty)
    XCTAssertTrue(deletes(stub).isEmpty)
    XCTAssertNil(flow.supersedes)
  }

  /// A row with a published product the flow knows about is never deleted.
  func testPublishedRowIsKept() async {
    let stub = StubTransport(body: okBody)
    let flow = flowWithPiece("p1")
    flow.products["p1"] = Product(id: "pr1", artworkId: "p1", type: .sticker, status: "published")
    flow.beginReframe()
    XCTAssertTrue(flow.hasPublishedProduct("p1"))
    XCTAssertNil(flow.dropSuperseded(except: "p2", api: api(stub)))
    XCTAssertTrue(deletes(stub).isEmpty)

    let other = flowWithPiece("q1")
    other.product = Product(id: "pr2", artworkId: "q1", type: .tote, status: "published")
    XCTAssertTrue(other.hasPublishedProduct("q1"))
    var withSummary = Artwork(id: "s1", cleanedUrl: "c")
    withSummary.products = [ArtworkProduct(id: "x", type: .sticker, status: "published")]
    let third = CreateFlow()
    third.pieceArtwork = withSummary
    XCTAssertTrue(third.hasPublishedProduct("s1"))
    let draft = flowWithPiece("d1")
    draft.products["d1"] = Product(id: "pr3", artworkId: "d1", type: .sticker, status: "draft")
    XCTAssertFalse(draft.hasPublishedProduct("d1"), "a draft product does not protect the row")
  }

  /// A failed delete is logged and ignored: no throw, the flow goes on.
  func testFailedDeleteIsIgnored() async {
    let stub = StubTransport(status: 500, body: #"{"error":{"code":"server","message":"x"}}"#)
    let flow = flowWithPiece("p1")
    flow.beginReframe()
    let task = flow.dropSuperseded(except: "p2", api: api(stub))
    await task?.value
    XCTAssertEqual(deletes(stub), ["p1"])
    XCTAssertNil(flow.supersedes)
    XCTAssertNil(flow.dropRow("p1", api: api(stub)), "not retried")
  }

  /// A late answer after the photo was discarded deletes its own row; one a recovery applied stays.
  func testStaleAnswerDeletesItsOwnRow() async {
    let stub = StubTransport(body: okBody)
    let flow = CreateFlow()
    await flow.dropIfStale("n1", api: api(stub))?.value
    XCTAssertEqual(deletes(stub), ["n1"])
    flow.photoArtwork = Artwork(id: "n2", cleanedUrl: "c")
    XCTAssertNil(flow.dropIfStale("n2", api: api(stub)))
    XCTAssertEqual(deletes(stub), ["n1"])
  }

  func testDeleteTellsMyDesignsToFetchAgain() async {
    let stub = StubTransport(body: okBody)
    let flow = flowWithPiece("p1")
    var told = 0
    flow.onRowDropped = { told += 1 }
    await flow.dropRow("p1", api: api(stub))?.value
    XCTAssertEqual(told, 1)
  }

  func testCachedFrameKeepsNothingToReplace() {
    let flow = flowWithPiece("p1")
    flow.photo = UIImage()
    flow.cropBox = [0, 0, 10, 10]
    flow.supersedes = "old"
    XCTAssertEqual(flow.routeAfterArea(box: [0, 0, 10, 10]), .yourCutout("p1"))
    XCTAssertNil(flow.supersedes)
  }

  // MARK: My designs

  func testMyDesignsHidesRowsWithNoDrawing() {
    let shown = DesignsStore.shown([
      Artwork(id: "a", cleanedUrl: "u"),
      Artwork(id: "b", lastError: "no_drawing_found"),
      Artwork(id: "c", lastError: "something_else"),
      Artwork(id: "d", cleanedUrl: "u", lastError: "no_drawing_found"),
      Artwork(id: "e"),
    ])
    XCTAssertEqual(shown.map(\.id), ["a", "c", "d", "e"])
  }
}
