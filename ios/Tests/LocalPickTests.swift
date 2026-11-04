import XCTest
@testable import The3rdEye

/// T155: a tap on the strip is local (the stage shows the piece's own cut, no request); "Use this"
/// sends the pick `cleanup` only when the piece differs from the one the row was cut from; a piece
/// whose cut is not ready is read again once after 2 s, then picked the old way.
@MainActor
final class LocalPickTests: XCTestCase {
  private let base = URL(string: "http://localhost:3000/api/v1")!
  private let size = ImageSize(w: 1200, h: 1600)
  private let one = Candidate(id: "cand-1", bbox: [100, 160, 500, 693], cleanedUrl: "https://x/cand-1.png")
  private let two = Candidate(id: "cand-2", bbox: [660, 896, 1060, 1429], cleanedUrl: "https://x/cand-2.png")

  private func photoFlow(candidates: [Candidate]? = nil) -> CreateFlow {
    let flow = CreateFlow()
    flow.recordPhoto(PhotoArtworkResponse(artwork: Artwork(id: "p1", cleanedUrl: "https://x/row.png"),
                                          candidates: candidates ?? [one, two], imageSize: size), box: [0, 0, 600, 800])
    return flow
  }

  func testCandidateDecodesItsCut() throws {
    let json = #"{"id":"cand-2","bbox":[1,2,3,4],"cleanedUrl":"https://x/c2.png"}"#
    XCTAssertEqual(try JSONDecoder().decode(Candidate.self, from: Data(json.utf8)).cleanedUrl, "https://x/c2.png")
    let old = #"{"id":"cand-2","bbox":[1,2,3,4]}"#
    XCTAssertNil(try JSONDecoder().decode(Candidate.self, from: Data(old.utf8)).cleanedUrl, "older servers")
  }

  func testTapSelectsThePieceAndShowsItsCutWithNoRequest() throws {
    let flow = photoFlow()
    XCTAssertEqual(flow.cut(for: "p1")?.stageUrl, "https://x/row.png", "the row's own cut first")
    flow.pickPiece("cand-2", for: "p1")
    let cut = try XCTUnwrap(flow.cut(for: "p1"))
    XCTAssertEqual(cut.selected, ["cand-2"])
    XCTAssertEqual(cut.cutFrom, "cand-1", "the row is still cut from the first piece")
    XCTAssertEqual(cut.stageUrl, "https://x/cand-2.png", "the stage shows the piece's own cut")
    XCTAssertEqual(flow.pieceCutFrom, "cand-1")
    XCTAssertEqual(flow.pieceArtwork?.cleanedUrl, "https://x/row.png", "the row is not touched")
  }

  func testUseThisSendsThePickOnlyWhenThePieceDiffers() throws {
    let flow = photoFlow()
    XCTAssertNil(flow.cut(for: "p1")?.pendingPick, "the piece cut: Use this sends nothing")
    flow.pickPiece("cand-2", for: "p1")
    XCTAssertEqual(flow.cut(for: "p1")?.pendingPick,
                   CleanupRequest(candidateIds: ["cand-2"], box: [0, 0, 1200, 1600], clipToBox: true))
    flow.pickPiece("cand-1", for: "p1")
    XCTAssertNil(flow.cut(for: "p1")?.pendingPick, "back to the piece cut: nothing to send")
    XCTAssertEqual(flow.cut(for: "p1")?.stageUrl, "https://x/row.png", "the row's cut (with its marks) again")
  }

  func testTheSentPickBecomesThePieceCutFrom() {
    let flow = photoFlow()
    flow.pickPiece("cand-2", for: "p1")
    let request = flow.cut(for: "p1")!.pendingPick!
    flow.recordCut(of: "p1", Artwork(id: "p1", cleanedUrl: "https://x/row2.png"), request: request)
    XCTAssertEqual(flow.pieceCutFrom, "cand-2")
    XCTAssertNil(flow.cut(for: "p1")?.pendingPick, "a second Use this sends nothing")
    XCTAssertEqual(flow.cut(for: "p1")?.stageUrl, "https://x/row2.png")
  }

  func testMarksGoWithTheSelectedPiece() throws {
    let flow = photoFlow()
    flow.pickPiece("cand-2", for: "p1")
    let request = try XCTUnwrap(CutoutRequest.marks([CutoutPoint(x: 5, y: 5, label: .positive)], on: flow.cut(for: "p1")!))
    XCTAssertEqual(request.candidateIds, ["cand-2"])
    flow.recordCut(of: "p1", Artwork(id: "p1", cleanedUrl: "https://x/marks.png"), request: request)
    XCTAssertEqual(flow.pieceCutFrom, "cand-2", "the marks re-cut the row from the selected piece")
    XCTAssertNil(flow.cut(for: "p1")?.pendingPick)
  }

  /// Web review rule: after marks, a tap on any piece (the same one included) shows its raw cut, so
  /// "Use this" must send the pick for the saved cut to match what is shown.
  func testAfterMarksTappingBackToTheSamePieceStillSendsThePick() throws {
    let flow = photoFlow()
    let marks = try XCTUnwrap(CutoutRequest.marks([CutoutPoint(x: 5, y: 5, label: .positive)], on: flow.cut(for: "p1")!))
    flow.recordCut(of: "p1", Artwork(id: "p1", cleanedUrl: "https://x/marked.png"), request: marks)
    XCTAssertNil(flow.cut(for: "p1")?.pendingPick, "no tap: the marked cut is the one shown and saved")
    XCTAssertEqual(flow.cut(for: "p1")?.stageUrl, "https://x/marked.png")
    flow.pickPiece("cand-2", for: "p1")
    flow.pickPiece("cand-1", for: "p1")
    XCTAssertEqual(flow.cut(for: "p1")?.stageUrl, "https://x/cand-1.png", "the raw cut of piece 1")
    let pick = try XCTUnwrap(flow.cut(for: "p1")?.pendingPick, "Use this sends the pick")
    XCTAssertEqual(pick, CleanupRequest(candidateIds: ["cand-1"], box: [0, 0, 1200, 1600], clipToBox: true))
    flow.recordCut(of: "p1", Artwork(id: "p1", cleanedUrl: "https://x/raw1.png"), request: pick)
    XCTAssertNil(flow.cut(for: "p1")?.pendingPick, "adopted: nothing more to send")
    flow.pickPiece("cand-1", for: "p1")
    XCTAssertNil(flow.cut(for: "p1")?.pendingPick, "the raw cut is saved: a tap on it sends nothing")
  }

  func testPickOnAChangeIsLocalToo() {
    let flow = CreateFlow()
    flow.changeCuts["ch1"] = Cut(artwork: Artwork(id: "ch1", cleanedUrl: "https://x/ch1.png"), candidates: [one, two],
                                 imageSize: size, selected: ["cand-1"], box: nil)
    flow.pickPiece("cand-2", for: "ch1")
    XCTAssertEqual(flow.changeCuts["ch1"]?.selected, ["cand-1"], "the stored cut is not changed")
    XCTAssertEqual(flow.cut(for: "ch1")?.selected, ["cand-2"])
    XCTAssertEqual(flow.cut(for: "ch1")?.stageUrl, "https://x/cand-2.png")
    XCTAssertEqual(flow.cut(for: "ch1")?.pendingPick?.candidateIds, ["cand-2"])
  }

  func testANewPhotoForgetsThePick() {
    let flow = photoFlow()
    flow.pickPiece("cand-2", for: "p1")
    XCTAssertEqual(flow.cut(for: "p1")?.selected, ["cand-2"])
    flow.discardPhoto()
    XCTAssertTrue(flow.pickedPieces.isEmpty)
    flow.recordPhoto(PhotoArtworkResponse(artwork: Artwork(id: "p1", cleanedUrl: "https://x/row.png"),
                                          candidates: [one, two], imageSize: size), box: [0, 0, 600, 800])
    XCTAssertEqual(flow.cut(for: "p1")?.selected, ["cand-1"], "the same row id again: the old pick is gone")
    // A new crop without a discard (setPhoto) forgets it too.
    flow.pickPiece("cand-2", for: "p1")
    flow.recordPhoto(PhotoArtworkResponse(artwork: Artwork(id: "p1", cleanedUrl: "https://x/row.png"),
                                          candidates: [one, two], imageSize: size), box: [0, 0, 600, 800])
    XCTAssertEqual(flow.cut(for: "p1")?.selected, ["cand-1"])
  }

  func testBackForgetsAnUnsentPick() {
    let flow = photoFlow()
    flow.pickPiece("cand-2", for: "p1")
    flow.forgetPick(for: "p1")
    XCTAssertEqual(flow.cut(for: "p1")?.selected, ["cand-1"], "the piece the row was cut from")
    XCTAssertNil(flow.cut(for: "p1")?.pendingPick)
  }

  func testPickWithoutASizeIsNotPossible() {
    let cut = Cut(artwork: Artwork(id: "p1", cleanedUrl: "a"), candidates: [one, two], imageSize: nil, selected: ["cand-2"], box: nil, cutFrom: "cand-1")
    XCTAssertTrue(cut.pickIsPending)
    XCTAssertNil(cut.pendingPick, "no box: the view refuses the tap, or fills the size first")
    var sized = cut
    sized.imageSize = size
    XCTAssertEqual(sized.pendingPick?.box, [0, 0, 1200, 1600])
  }

  func testAMissingCutIsReadAgainOnce() async throws {
    let pending = Candidate(id: "cand-2", bbox: two.bbox)
    let flow = photoFlow(candidates: [one, pending])
    flow.pickPiece("cand-2", for: "p1")
    XCTAssertNil(flow.cut(for: "p1")?.stageUrl, "not ready yet")
    let detail = #"{"artwork":{"id":"p1"},"candidates":[{"id":"cand-1","bbox":[100,160,500,693],"cleanedUrl":"https://x/cand-1.png"},{"id":"cand-2","bbox":[660,896,1060,1429],"cleanedUrl":"https://x/cand-2.png"}]}"#
    let stub = StubTransport(body: detail)
    let api = APIClient(baseURL: base, transport: stub, token: "t")
    let fallback = await flow.awaitPieceCut("cand-2", for: "p1", api: api, delay: .zero)
    XCTAssertNil(fallback, "the cut came: no pick request")
    XCTAssertEqual(stub.requests.count, 1)
    XCTAssertEqual(stub.requests.first?.url?.path, "/api/v1/artworks/p1")
    XCTAssertEqual(flow.cut(for: "p1")?.stageUrl, "https://x/cand-2.png")
  }

  func testAStillMissingCutFallsBackToThePickRequest() async throws {
    let pending = Candidate(id: "cand-2", bbox: two.bbox)
    let flow = photoFlow(candidates: [one, pending])
    flow.pickPiece("cand-2", for: "p1")
    let detail = #"{"artwork":{"id":"p1"},"candidates":[{"id":"cand-1","bbox":[100,160,500,693]},{"id":"cand-2","bbox":[660,896,1060,1429]}]}"#
    let stub = StubTransport(body: detail)
    let fallback = await flow.awaitPieceCut("cand-2", for: "p1", api: APIClient(baseURL: base, transport: stub, token: "t"), delay: .zero)
    XCTAssertEqual(fallback, CleanupRequest(candidateIds: ["cand-2"], box: [0, 0, 1200, 1600], clipToBox: true),
                   "today's pick")
    XCTAssertEqual(stub.requests.count, 1, "read once")
  }

  func testAMissingCutIsNotPickedWhenAnotherPieceWasTappedMeanwhile() async {
    let pending = Candidate(id: "cand-2", bbox: two.bbox)
    let flow = photoFlow(candidates: [one, pending])
    flow.pickPiece("cand-2", for: "p1")
    flow.pickPiece("cand-1", for: "p1")
    let stub = StubTransport(status: 500, body: "{}")
    let fallback = await flow.awaitPieceCut("cand-2", for: "p1", api: APIClient(baseURL: base, transport: stub, token: "t"), delay: .zero)
    XCTAssertNil(fallback)
  }
}
