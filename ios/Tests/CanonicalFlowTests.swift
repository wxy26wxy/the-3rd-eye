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

  func testUseThisAreaCutsTheCropFirstThenOnlyWhenTheFrameChanges() {
    let flow = CreateFlow()
    let area = AreaFrame.whole(size)
    XCTAssertNil(flow.routeAfterArea(box: area.box), "no local photo")
    flow.photo = UIGraphicsImageRenderer(size: CGSize(width: 12, height: 16)).image { _ in }
    XCTAssertEqual(flow.routeAfterArea(box: area.box), .makingCutout(.area(area.box)), "first time: crop and cut")
    flow.recordPhoto(PhotoArtworkResponse(artwork: Artwork(id: "p1", cleanedUrl: "https://x/cut1.png"), candidates: [one, two], imageSize: size), box: area.box)
    XCTAssertEqual(flow.pieceCutFrom, "cand-1")
    XCTAssertEqual(flow.cropBox, area.box)
    XCTAssertEqual(flow.routeAfterArea(box: area.box), .yourCutout("p1"), "same frame: no second upload")
    let smaller = area.shrunk(in: size)
    XCTAssertEqual(flow.routeAfterArea(box: smaller.box), .makingCutout(.area(smaller.box)), "a new frame is a new crop")
  }

  /// Ruling 2: Your cutout › Use this is Change it, for the piece and for a change's cut-out (the
  /// change goes on screen); "Looks good as is" needs the product of the cut on screen.
  func testYourCutoutGoesToChangeItAndLooksGoodNeedsTheProduct() {
    let flow = photoFlow()
    flow.productType = .sticker
    XCTAssertNil(flow.routeAfterCutout(of: "p1"), "nothing cut yet")
    let piece = Artwork(id: "p1", cleanedUrl: "https://x/cut1.png")
    flow.recordCut(of: "p1", piece, request: CleanupRequest(candidateIds: ["cand-1"], box: [0, 0, 10, 10], clipToBox: true))
    XCTAssertEqual(flow.routeAfterCutout(of: "p1"), .changeIt, "the piece's cut-out: on to Change it")
    XCTAssertEqual(flow.currentCut, piece)
    XCTAssertNil(flow.routeAfterLooksGood(), "no product yet: the making state")
    let sticker = Product(id: "pr-new-sticker", artworkId: "p1", type: .sticker, mockupUrl: "https://x/m.png")
    flow.useProduct(sticker, madeFrom: piece)
    XCTAssertEqual(flow.readyProduct(for: piece), sticker)
    XCTAssertEqual(flow.routeAfterLooksGood(), .listingDetails)
    XCTAssertEqual(flow.artwork, piece)
    XCTAssertEqual(flow.product, sticker)

    flow.addChange(change("ch1", from: piece))
    XCTAssertNil(flow.currentCut, "a change without its cut-out has no product art")
    let cut = Artwork(id: "ch1", cleanedUrl: "https://x/ch1-cut.png")
    flow.changeCuts["ch1"] = Cut(artwork: cut, candidates: [one], imageSize: size, selected: ["cand-1"], box: nil)
    XCTAssertEqual(flow.currentCut, cut)
    XCTAssertNil(flow.routeAfterLooksGood(), "the change's product is not made yet")
    flow.stepBack()
    XCTAssertEqual(flow.routeAfterCutout(of: "ch1"), .changeIt)
    XCTAssertEqual(flow.changedArtwork?.id, "ch1", "Fix the cutout of the change: the change is on screen again")
  }

  /// Ruling 2 / T143: a cleanup's `products` swap the product photo; a re-cut without them asks
  /// for the product again (refresh), never a second one.
  func testCleanupProductsRebuildTheProductOnScreen() {
    let flow = photoFlow()
    flow.productType = .sticker
    let piece = Artwork(id: "p1", cleanedUrl: "cut-1")
    flow.recordCut(of: "p1", piece)
    flow.useProduct(Product(id: "pr1", artworkId: "p1", type: .sticker, mockupUrl: "m-1"), madeFrom: piece)
    let recut = Artwork(id: "p1", cleanedUrl: "cut-2")
    flow.recordCut(of: "p1", recut)
    XCTAssertNil(flow.readyProduct(for: flow.currentCut), "the old photo is for the old cut")
    XCTAssertEqual(flow.productPlan(for: recut, type: .sticker), .refresh(Product(id: "pr1", artworkId: "p1", type: .sticker, mockupUrl: "m-1")))
    flow.applyRebuilt([ArtworkProduct(id: "pr1", type: .sticker, status: "draft", mockupUrl: "m-2")], for: recut)
    XCTAssertEqual(flow.readyProduct(for: recut)?.mockupUrl, "m-2", "the rebuilt photo from the cleanup answer")
    XCTAssertEqual(flow.productPlan(for: recut, type: .sticker), .reuse(flow.products["p1"]!))
  }

  /// A saved design's draft in a cleanup answer becomes the product (no second POST /products).
  func testRebuiltDraftOfASavedDesignIsAdopted() {
    let flow = CreateFlow()
    flow.productType = .tote
    let cut = Artwork(id: "d2", cleanedUrl: "c")
    flow.applyRebuilt([ArtworkProduct(id: "pr-s", type: .sticker, status: "draft", mockupUrl: "s"),
                       ArtworkProduct(id: "pr-t", type: .tote, status: "draft", mockupUrl: "t")], for: cut)
    XCTAssertEqual(flow.readyProduct(for: cut)?.id, "pr-t")
    XCTAssertEqual(flow.readyProduct(for: cut)?.mockupUrl, "t")
  }

  // MARK: Cut-outs

  /// Round 4: the crop is the whole picture, so the photo's cut has no box of its own.
  func testCutOfTheCropIsTheWholePictureAndTheChangeUsesItsOwnPieces() {
    let flow = photoFlow()
    flow.recordCut(of: "p1", Artwork(id: "p1", cleanedUrl: "u"), request: CleanupRequest(candidateIds: ["cand-1"], box: [0, 0, 1200, 1600], clipToBox: true))
    let piece = flow.cut(for: "p1")
    XCTAssertEqual(piece?.selected, ["cand-1"])
    XCTAssertNil(piece?.box)
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
