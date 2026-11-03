import XCTest
@testable import The3rdEye

/// T131: the canonical order (Adjust the area → Making your cutout → Your cutout → Change it, a kept
/// change cut once and shown again), the Your cutout marks, "Back to my original" one step, the
/// no-drawing answer and the listing agent's first run.
@MainActor
final class CanonicalFlowTests: XCTestCase {
  private let base = URL(string: "http://localhost:3000/api/v1")!
  private let size = ImageSize(w: 1200, h: 1600)
  private let one = Candidate(id: "cand-1", bbox: [100, 160, 500, 693])
  private let two = Candidate(id: "cand-2", bbox: [660, 896, 1060, 1429])

  private func photoFlow() -> CreateFlow {
    let flow = CreateFlow()
    flow.setPhoto(artwork: Artwork(id: "p1"), candidates: [one, two], imageSize: size)
    return flow
  }

  private func change(_ id: String, from base: Artwork) -> ChangeStep {
    ChangeStep(artwork: Artwork(id: id, parentArtworkId: base.id, previewUrl: "https://x/\(id).png"), base: base, instruction: "Change \(id)")
  }

  // MARK: Route table

  func testUseThisAreaDetectsFirstThenOnlyWhenTheFrameChanges() {
    let flow = photoFlow()
    let area = AreaFrame.whole(size)
    XCTAssertEqual(flow.routeAfterArea(box: area.box), .makingCutout(.detect(area.box)), "first time: always detect")
    flow.recordDetect(DetectResponse(artwork: Artwork(id: "p1", cleanedUrl: "https://x/cut1.png"), candidates: [one, two], imageSize: size), box: area.box)
    XCTAssertEqual(flow.pieceCutFrom, "cand-1")
    XCTAssertEqual(flow.pieceBox, area.box)
    XCTAssertEqual(flow.routeAfterArea(box: area.box), .yourCutout("p1"), "same frame: no second cut")
    let smaller = area.shrunk(in: size)
    XCTAssertEqual(flow.routeAfterArea(box: smaller.box), .makingCutout(.detect(smaller.box)), "a new frame detects again")
  }

  func testYourCutoutGoesToChangeItFirstAndToTheProductAfterAChange() {
    let flow = photoFlow()
    XCTAssertNil(flow.routeAfterCutout(of: "p1"), "nothing cut yet")
    let piece = Artwork(id: "p1", cleanedUrl: "https://x/cut1.png")
    flow.recordCut(of: "p1", piece, request: CleanupRequest(candidateIds: ["cand-1"], box: [0, 0, 10, 10], clipToBox: true))
    XCTAssertEqual(flow.routeAfterCutout(of: "p1"), .changeIt, "the piece's cut-out: on to Change it")
    XCTAssertNil(flow.artwork, "the product art is not picked yet")

    flow.addChange(change("ch1", from: piece))
    XCTAssertEqual(flow.routeAfterKeepingChange(), .makingCutout(.change("ch1")), "a kept change is cut out")
    let cut = Artwork(id: "ch1", cleanedUrl: "https://x/ch1-cut.png")
    flow.changeCuts["ch1"] = Cut(artwork: cut, candidates: [one], imageSize: size, selected: ["cand-1"], box: nil)
    XCTAssertEqual(flow.routeAfterKeepingChange(), .yourCutout("ch1"), "cached: no second cutout")
    XCTAssertEqual(flow.routeAfterCutout(of: "ch1"), .makingProduct)
    XCTAssertEqual(flow.artwork?.cleanedUrl, "https://x/ch1-cut.png", "the change's cut-out becomes the product")
  }

  func testLooksGoodMakesTheProductFromTheReviewedCut() {
    let flow = photoFlow()
    XCTAssertNil(flow.routeAfterLooksGood())
    let piece = Artwork(id: "p1", cleanedUrl: "https://x/cut1.png")
    flow.recordCut(of: "p1", piece)
    XCTAssertEqual(flow.routeAfterLooksGood(), .makingProduct)
    XCTAssertEqual(flow.artwork?.id, "p1")

    // A change shown on Change it (Change it again, or one step back) that was never cut out.
    flow.addChange(change("ch1", from: piece))
    XCTAssertEqual(flow.routeAfterLooksGood(), .makingCutout(.change("ch1")))
    flow.changeCuts["ch1"] = Cut(artwork: Artwork(id: "ch1", cleanedUrl: "https://x/ch1-cut.png"), candidates: [], imageSize: size, selected: [], box: nil)
    XCTAssertEqual(flow.routeAfterLooksGood(), .makingProduct)
    XCTAssertEqual(flow.artwork?.cleanedUrl, "https://x/ch1-cut.png")
  }

  // MARK: Cut-outs

  func testCutOfThePhotoUsesTheFrameAndTheChangeUsesItsOwnPieces() {
    let flow = photoFlow()
    flow.recordCut(of: "p1", Artwork(id: "p1", cleanedUrl: "u"), request: CleanupRequest(candidateIds: ["cand-1"], box: [84, 138, 516, 714], clipToBox: true))
    let piece = flow.cut(for: "p1")
    XCTAssertEqual(piece?.selected, ["cand-1"])
    XCTAssertEqual(piece?.box, [84, 138, 516, 714])
    XCTAssertEqual(piece?.imageSize, size)
    XCTAssertNil(flow.cut(for: "ch9"))
  }

  /// A new cut of a change (Apply cutout) reaches the cache and every step that shows it.
  func testRecordCutOfAChangeUpdatesTheCacheAndTheChain() {
    let flow = photoFlow()
    let piece = Artwork(id: "p1", cleanedUrl: "u")
    flow.recordCut(of: "p1", piece)
    flow.addChange(change("ch1", from: piece))
    flow.addChange(change("ch2", from: flow.changedArtwork!))
    flow.changeCuts["ch1"] = Cut(artwork: Artwork(id: "ch1", cleanedUrl: "c1"), candidates: [one], imageSize: size, selected: ["cand-1"], box: nil)
    flow.recordCut(of: "ch1", Artwork(id: "ch1", cleanedUrl: "c1-marked"))
    XCTAssertEqual(flow.changeCuts["ch1"]?.artwork.cleanedUrl, "c1-marked")
    XCTAssertEqual(flow.changeBase?.cleanedUrl, "c1-marked", "ch2's Before follows")
    XCTAssertEqual(flow.changeCuts["ch1"]?.selected, ["cand-1"], "the piece stays")
  }

  // MARK: Marks → body

  func testMarksOnThePieceSendTheFrameAndThePiece() {
    let cut = Cut(artwork: Artwork(id: "p1"), candidates: [one, two], imageSize: size, selected: ["cand-1"], box: [84, 138, 516, 714])
    let marks = [CutoutPoint(x: 300, y: 400, label: .positive), CutoutPoint(x: 450, y: 600, label: .negative)]
    XCTAssertEqual(CutoutRequest.marks(marks, on: cut),
                   CleanupRequest(candidateIds: ["cand-1"], points: marks, box: [84, 138, 516, 714], clipToBox: true))
    XCTAssertNil(CutoutRequest.marks([], on: cut), "nothing to apply without marks")
  }

  func testMarksOnAChangeSendTheWholePictureAndItsPiece() {
    let cut = Cut(artwork: Artwork(id: "ch1"), candidates: [two], imageSize: ImageSize(w: 1024, h: 1024), selected: ["cand-2"], box: nil)
    let marks = [CutoutPoint(x: 10, y: 20, label: .positive)]
    XCTAssertEqual(CutoutRequest.marks(marks, on: cut),
                   CleanupRequest(candidateIds: ["cand-2"], points: marks, box: [0, 0, 1024, 1024], clipToBox: true))
    let noPieces = Cut(artwork: Artwork(id: "ch1"), candidates: [], imageSize: ImageSize(w: 1024, h: 1024), selected: [], box: nil)
    XCTAssertNil(CutoutRequest.marks(marks, on: noPieces)?.candidateIds, "no piece: the box and the marks alone")
    let unknown = Cut(artwork: Artwork(id: "ch1"), candidates: [], imageSize: nil, selected: [], box: nil)
    XCTAssertNil(CutoutRequest.marks(marks, on: unknown), "no size: no box to send")
  }

  func testAtMostTenMarksAreSent() {
    let cut = Cut(artwork: Artwork(id: "p1"), candidates: [], imageSize: size, selected: [], box: [0, 0, 10, 10])
    let many = (0..<12).map { CutoutPoint(x: Double($0), y: 1, label: .positive) }
    XCTAssertEqual(CutoutRequest.marks(many, on: cut)?.points?.count, CutoutRequest.maxPoints)
  }

  func testAddTheAreaAroundYourArtTargetsThePieceOrTheWholePicture() {
    XCTAssertEqual(CutoutRequest.accessPoint(piece: one, image: size), CutoutPoint(x: 300, y: 426.5, label: .positive))
    XCTAssertEqual(CutoutRequest.accessPoint(piece: nil, image: size), CutoutPoint(x: 600, y: 800, label: .positive))
    XCTAssertNil(CutoutRequest.accessPoint(piece: nil, image: nil))
  }

  func testMarkUnderATapIsTheNearestWithinItsDot() {
    let centres = [CGPoint(x: 10, y: 10), CGPoint(x: 30, y: 10)]
    XCTAssertEqual(CutoutGeometry.markIndex(at: CGPoint(x: 26, y: 10), centres: centres, radius: 12), 1)
    XCTAssertNil(CutoutGeometry.markIndex(at: CGPoint(x: 80, y: 80), centres: centres, radius: 12))
  }

  func testEmptiedCutWithMarksSaysToRemoveMarks() {
    let none = APIError.server(status: 422, code: "no_drawing_found", message: "x")
    let withMarks = CleanupRequest(points: [CutoutPoint(x: 1, y: 1, label: .negative)], box: [0, 0, 2, 2], clipToBox: true)
    XCTAssertEqual(CleanupResult.errorMessage(for: none, request: withMarks), "Nothing was left in the cutout. Remove some marks, then tap Apply cutout.")
    XCTAssertTrue(CleanupResult.errorMessage(for: none)?.contains("Make the frame bigger") == true)
  }

  /// The mark body reaches the server as sent (cleanup on a change result).
  func testMarksBodyIsEncoded() async throws {
    let stub = StubTransport(body: #"{"id":"ch1","cleanedUrl":"https://x/c.png","parentArtworkId":"p1"}"#)
    let api = APIClient(baseURL: base, transport: stub, token: "t")
    let cut = Cut(artwork: Artwork(id: "ch1"), candidates: [one], imageSize: size, selected: ["cand-1"], box: nil)
    let request = try XCTUnwrap(CutoutRequest.marks([CutoutPoint(x: 600, y: 800, label: .negative)], on: cut))
    _ = try await api.cleanup(artworkId: "ch1", request)
    let req = try XCTUnwrap(stub.requests.first)
    XCTAssertEqual(req.url?.path, "/api/v1/artworks/ch1/cleanup")
    let json = try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(req.httpBody)) as? [String: Any])
    XCTAssertEqual(json["candidateIds"] as? [String], ["cand-1"])
    XCTAssertEqual(json["box"] as? [Double], [0, 0, 1200, 1600])
    XCTAssertEqual(json["clipToBox"] as? Bool, true)
    XCTAssertEqual((json["points"] as? [[String: Any]])?.first?["label"] as? String, "negative")
  }

  // MARK: Back to my original (one step)

  func testBackToMyOriginalStepsBackOneChangeAndKeepsTheChain() {
    let flow = photoFlow()
    let piece = Artwork(id: "p1", cleanedUrl: "u")
    flow.recordCut(of: "p1", piece)
    flow.addChange(change("ch1", from: piece))
    flow.addChange(change("ch2", from: flow.changedArtwork!))
    XCTAssertEqual(flow.changedArtwork?.id, "ch2")
    XCTAssertEqual(flow.changeBase?.id, "ch1")
    XCTAssertEqual(flow.changeAsked, "Change ch2")
    flow.stepBack()
    XCTAssertEqual(flow.currentArt?.id, "ch1", "one change back")
    XCTAssertEqual(flow.changeBase?.id, "p1")
    XCTAssertEqual(flow.changeAsked, "Change ch1")
    XCTAssertEqual(flow.changes.map(\.artwork.id), ["ch1", "ch2"], "the chain is kept")
    flow.stepBack()
    XCTAssertEqual(flow.currentArt?.id, "p1", "back at the picked piece")
    XCTAssertNil(flow.changedArtwork)
    flow.stepBack()
    XCTAssertEqual(flow.currentArt?.id, "p1", "nothing further back")
    XCTAssertEqual(flow.changes.count, 2)
  }

  /// A new cut of the piece (another frame) drops the changes made from the old one and their cuts.
  func testResetChangeDropsTheChainAndItsCuts() {
    let flow = photoFlow()
    flow.addChange(change("ch1", from: Artwork(id: "p1")))
    flow.changeCuts["ch1"] = Cut(artwork: Artwork(id: "ch1"), candidates: [], imageSize: nil, selected: [], box: nil)
    flow.resetChange()
    XCTAssertTrue(flow.changes.isEmpty)
    XCTAssertTrue(flow.changeCuts.isEmpty)
    XCTAssertNil(flow.changedArtworkId)
  }

  // MARK: No drawing found

  func testNoDrawingAnswerCarriesTheStoredPhoto() async throws {
    let stub = StubTransport(status: 422, body: #"{"error":{"code":"no_drawing_found","message":"No drawing here.","artworkId":"p7"}}"#)
    let api = APIClient(baseURL: base, transport: stub, token: "t")
    do {
      _ = try await api.artworkFromPhoto(imageUrl: "https://x/p.jpg", product: .sticker)
      XCTFail("expected the 422")
    } catch let none as NoDrawingFound {
      XCTAssertEqual(none.artworkId, "p7")
      XCTAssertEqual(none.localizedDescription, "No drawing here.")
    }
    // Without the id it stays the server's error.
    stub.body = #"{"error":{"code":"no_drawing_found","message":"No drawing here."}}"#
    do {
      _ = try await api.artworkFromPhoto(imageUrl: "https://x/p.jpg", product: .sticker)
      XCTFail("expected the 422")
    } catch {
      XCTAssertEqual(error as? APIError, .server(status: 422, code: "no_drawing_found", message: "No drawing here."))
    }
  }

  // MARK: Listing agent

  func testListingAgentRunsOnTheFirstVisitOnly() {
    XCTAssertTrue(ListingPhase.autoRuns(title: "", savedTitle: nil, alreadyRan: false), "first visit, any mode")
    XCTAssertFalse(ListingPhase.autoRuns(title: "", savedTitle: nil, alreadyRan: true), "ran here already")
    XCTAssertFalse(ListingPhase.autoRuns(title: "", savedTitle: "Frog King Sticker", alreadyRan: false), "a saved listing (draft, or an earlier run)")
    XCTAssertFalse(ListingPhase.autoRuns(title: "Typed", savedTitle: nil, alreadyRan: false))
    XCTAssertTrue(ListingPhase.autoRuns(title: " ", savedTitle: " ", alreadyRan: false))
  }
}
