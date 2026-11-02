import XCTest
@testable import The3rdEye

/// Adjust cutout (T082): view → image-pixel mapping, what each choice sends, and the API shapes.
@MainActor
final class CutoutTests: XCTestCase {
  private let base = URL(string: "http://localhost:3000/api/v1")!
  private let size = ImageSize(w: 1200, h: 1600)
  private let one = Candidate(id: "c1", bbox: [100, 160, 500, 693])
  private let two = Candidate(id: "c2", bbox: [660, 896, 1060, 1429])

  // MARK: Mapping

  func testTapScalesToImagePixels() {
    // Photo shown 300 × 400 pt for a 1200 × 1600 px original: × 4.
    let frame = CGRect(x: 0, y: 0, width: 300, height: 400)
    let p = CutoutGeometry.imagePoint(CGPoint(x: 75, y: 100), shownIn: frame, image: size)
    XCTAssertEqual(p.x, 300, accuracy: 0.001)
    XCTAssertEqual(p.y, 400, accuracy: 0.001)
  }

  func testTapHonoursLetterboxOffset() {
    // 1200 × 1600 aspect-fit into 400 × 400: shown 300 × 400 starting at x = 50.
    let frame = CutoutGeometry.fitRect(image: size, in: CGSize(width: 400, height: 400))
    XCTAssertEqual(frame, CGRect(x: 50, y: 0, width: 300, height: 400))
    let p = CutoutGeometry.imagePoint(CGPoint(x: 50 + 150, y: 200), shownIn: frame, image: size)
    XCTAssertEqual(p.x, 600, accuracy: 0.001)
    XCTAssertEqual(p.y, 800, accuracy: 0.001)
  }

  func testTapOutsideIsClampedToTheImage() {
    let frame = CGRect(x: 0, y: 0, width: 300, height: 400)
    let p = CutoutGeometry.imagePoint(CGPoint(x: -20, y: 500), shownIn: frame, image: size)
    XCTAssertEqual(p, CGPoint(x: 0, y: 1600))
  }

  func testViewPointRoundTrips() {
    let frame = CGRect(x: 10, y: 20, width: 300, height: 400)
    let v = CutoutGeometry.viewPoint(x: 600, y: 400, shownIn: frame, image: size)
    XCTAssertEqual(v, CGPoint(x: 160, y: 120))
    let back = CutoutGeometry.imagePoint(v, shownIn: frame, image: size)
    XCTAssertEqual(back, CGPoint(x: 600, y: 400))
  }

  func testDragMakesOrderedImageBox() {
    let frame = CGRect(x: 0, y: 0, width: 300, height: 400)
    // Dragged up and to the left: still x0 < x1, y0 < y1.
    let box = CutoutGeometry.imageBox(from: CGPoint(x: 200, y: 300), to: CGPoint(x: 50, y: 100), shownIn: frame, image: size)
    XCTAssertEqual(box, [200, 400, 800, 1200])
    XCTAssertNil(CutoutGeometry.imageBox(from: CGPoint(x: 10, y: 10), to: CGPoint(x: 10, y: 90), shownIn: frame, image: size), "a zero-width box is not sent")
  }

  func testCandidateRectInView() {
    let frame = CGRect(x: 0, y: 0, width: 300, height: 400)
    XCTAssertEqual(CutoutGeometry.viewRect(box: one.bbox, shownIn: frame, image: size), CGRect(x: 25, y: 40, width: 100, height: 133.25))
    XCTAssertNil(CutoutGeometry.viewRect(box: [1, 2], shownIn: frame, image: size))
  }

  // MARK: Requests

  func testOneCandidateWithoutMarksSelects() {
    XCTAssertEqual(CutoutRequest.action(selected: [one], points: [], box: nil), .select(candidateId: "c1"))
  }

  func testTwoCandidatesCombine() {
    XCTAssertEqual(CutoutRequest.action(selected: [one, two], points: [], box: nil),
                   .cleanup(CleanupRequest(candidateIds: ["c1", "c2"], points: nil, box: nil)))
  }

  func testCandidatesMarksAndBoxAreSentAsComposed() {
    let marks = [CutoutPoint(x: 300, y: 400, label: .positive), CutoutPoint(x: 700, y: 1000, label: .negative)]
    let request = CutoutRequest.make(selected: [one, two], points: marks, box: [50, 100, 1100, 1500])
    XCTAssertEqual(request, CleanupRequest(candidateIds: ["c1", "c2"], points: marks, box: [50, 100, 1100, 1500]))
    // A mark turns a single pick into a cleanup.
    XCTAssertEqual(CutoutRequest.action(selected: [one], points: [marks[1]], box: nil),
                   .cleanup(CleanupRequest(candidateIds: ["c1"], points: [marks[1]], box: nil)))
  }

  func testRedoAlwaysCleansUpSoProductNoticesArrive() {
    XCTAssertEqual(CutoutRequest.action(selected: [one], points: [], box: nil, productsMayExist: true),
                   .cleanup(CleanupRequest(candidateIds: ["c1"], points: nil, box: nil)))
  }

  func testRemoveMarkOnTheOnlyPieceLeavesNothing() {
    let onOne = CutoutPoint(x: 300, y: 400, label: .negative)
    let elsewhere = CutoutPoint(x: 1150, y: 50, label: .negative)
    XCTAssertTrue(CutoutRequest.leavesNothing(selected: [one], points: [onOne], box: nil))
    XCTAssertFalse(CutoutRequest.leavesNothing(selected: [one], points: [elsewhere], box: nil), "a mark outside the piece drops nothing")
    XCTAssertFalse(CutoutRequest.leavesNothing(selected: [one], points: [onOne], box: [0, 0, 600, 800]), "a box keeps something")
    XCTAssertFalse(CutoutRequest.leavesNothing(selected: [one, two], points: [onOne], box: nil), "the other piece stays")
    XCTAssertFalse(CutoutRequest.leavesNothing(selected: [one], points: [onOne, CutoutPoint(x: 1, y: 1, label: .positive)], box: nil))
  }

  /// The VoiceOver actions (and context menu) on a piece.
  func testPieceActionsMapToBoxAndCentrePoint() {
    XCTAssertEqual(CutoutRequest.box(around: two), [660, 896, 1060, 1429])
    XCTAssertEqual(CutoutRequest.centrePoint(of: two), CutoutPoint(x: 860, y: 1162.5, label: .positive))
    XCTAssertNil(CutoutRequest.box(around: Candidate(id: "x", bbox: [5, 5, 5, 9])))
    XCTAssertNil(CutoutRequest.centrePoint(of: Candidate(id: "x", bbox: [1, 2])))
    XCTAssertEqual(CutoutRequest.make(selected: [], points: [], box: CutoutRequest.box(around: two)),
                   CleanupRequest(candidateIds: nil, points: nil, box: [660, 896, 1060, 1429]))
  }

  func testZeroImageSizeIsNotUsable() {
    XCTAssertFalse(ImageSize(w: 0, h: 0).isUsable)
    XCTAssertFalse(ImageSize(w: 1200, h: 0).isUsable)
    XCTAssertTrue(size.isUsable)
  }

  func testNothingToSend() {
    XCTAssertNil(CutoutRequest.make(selected: [], points: [], box: nil))
    XCTAssertNil(CutoutRequest.action(selected: [], points: [], box: nil))
    // Only "Remove area" marks with no piece and no box: the API needs a positive point.
    XCTAssertNil(CutoutRequest.make(selected: [], points: [CutoutPoint(x: 1, y: 1, label: .negative)], box: nil))
    XCTAssertNotNil(CutoutRequest.make(selected: [], points: [], box: [0, 0, 10, 10]))
  }

  func testCleanupBodyEncodingLeavesOutUnsetKeys() async throws {
    let stub = StubTransport(body: #"{"id":"p1","cleanedUrl":"https://x/c.png","status":"ready"}"#)
    let api = APIClient(baseURL: base, transport: stub, token: "t")
    let result = try await api.cleanup(artworkId: "p1", CleanupRequest(candidateIds: ["c1", "c2"], points: [CutoutPoint(x: 600, y: 800, label: .positive)]))
    XCTAssertEqual(result.artwork.cleanedUrl, "https://x/c.png")
    XCTAssertEqual(result.failedProductIds, [])
    let req = try XCTUnwrap(stub.requests.first)
    XCTAssertEqual(req.httpMethod, "POST")
    XCTAssertEqual(req.url?.path, "/api/v1/artworks/p1/cleanup")
    XCTAssertEqual(req.timeoutInterval, APIClient.longTimeout)
    let json = try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(req.httpBody)) as? [String: Any])
    XCTAssertEqual(json["candidateIds"] as? [String], ["c1", "c2"])
    XCTAssertNil(json["box"], "unset keys are not sent")
    let points = try XCTUnwrap(json["points"] as? [[String: Any]])
    XCTAssertEqual(points.first?["label"] as? String, "positive")
    XCTAssertEqual(points.first?["x"] as? Double, 600)
  }

  func testCleanupReadsProductDetails() throws {
    let data = Data(#"{"id":"p1","cleanedUrl":"https://x/c.png","details":{"failedProductIds":["pr1"],"unpublishedProductIds":[]}}"#.utf8)
    let result = try JSONDecoder().decode(CleanupResult.self, from: data)
    XCTAssertEqual(result.artwork.id, "p1")
    XCTAssertEqual(result.failedProductIds, ["pr1"])
    XCTAssertEqual(result.productNotice, "Your cutout is saved. One product could not be rebuilt; try again later.")

    let unpublished = CleanupResult(artwork: result.artwork, unpublishedProductIds: ["pr2"])
    XCTAssertEqual(unpublished.productNotice, "One product went back to draft because the new cutout is too small to print. Open My designs to fix it.")
    XCTAssertNil(CleanupResult(artwork: result.artwork).productNotice)
    let empty = try JSONDecoder().decode(CleanupResult.self, from: Data(#"{"id":"p1","details":{"failedProductIds":[],"unpublishedProductIds":[]}}"#.utf8))
    XCTAssertNil(empty.productNotice)
  }

  func testPhotoAnswerAndDetailCarryImageSize() throws {
    let photo = try JSONDecoder().decode(PhotoArtworkResponse.self, from: Data(#"""
    {"artwork":{"id":"p1"},"candidates":[{"id":"c1","bbox":[1,2,3,4]}],"imageSize":{"w":1200,"h":1600}}
    """#.utf8))
    XCTAssertEqual(photo.imageSize, size)
    let old = try JSONDecoder().decode(PhotoArtworkResponse.self, from: Data(#"{"artwork":{"id":"p1"},"candidates":[]}"#.utf8))
    XCTAssertNil(old.imageSize)
    let detail = try JSONDecoder().decode(ArtworkDetailResponse.self, from: Data(#"""
    {"artwork":{"id":"p1"},"candidates":[],"imageSize":null,"originalUrl":null}
    """#.utf8))
    XCTAssertNil(detail.imageSize)
    XCTAssertNil(detail.originalUrl)
  }

  func testResetCutoutPicksTheOnlyCandidate() {
    let flow = CreateFlow()
    flow.points = [CutoutPoint(x: 1, y: 1, label: .positive)]
    flow.box = [0, 0, 1, 1]
    flow.cutoutNotice = "x"
    flow.resetCutout(artwork: Artwork(id: "p1"), candidates: [one], imageSize: size)
    XCTAssertEqual(flow.selectedCandidateIds, ["c1"])
    XCTAssertEqual(flow.cutoutArtwork?.id, "p1")
    XCTAssertEqual(flow.imageSize, size)
    XCTAssertTrue(flow.points.isEmpty)
    XCTAssertNil(flow.box)
    XCTAssertNil(flow.cutoutNotice)
    flow.resetCutout(artwork: Artwork(id: "p1"), candidates: [one, two], imageSize: size)
    XCTAssertEqual(flow.selectedCandidateIds, [], "with several pieces and no choice, none is assumed")
    flow.resetCutout(artwork: Artwork(id: "ch1"), candidates: [two, one], imageSize: size, selected: ["c2"])
    XCTAssertEqual(flow.selectedCandidateIds, ["c2"], "the piece the cut-out was made from")
  }

  // MARK: T091: marks close together, Retake

  func testTapDeletesOnlyOnAMarksDot() {
    let centres = [CGPoint(x: 100, y: 100), CGPoint(x: 118, y: 100)]
    XCTAssertEqual(CutoutGeometry.markIndex(at: CGPoint(x: 104, y: 98), centres: centres, radius: 12), 0)
    XCTAssertEqual(CutoutGeometry.markIndex(at: CGPoint(x: 112, y: 100), centres: centres, radius: 12), 1, "the nearest dot wins")
    XCTAssertNil(CutoutGeometry.markIndex(at: CGPoint(x: 100, y: 115), centres: centres, radius: 12),
                 "15 pt from a mark is outside its dot: a new mark goes there")
    XCTAssertNil(CutoutGeometry.markIndex(at: .zero, centres: [], radius: 12))
  }

  func testDiscardPhotoClearsMarksAndPieces() {
    let flow = CreateFlow()
    flow.photo = UIImage()
    flow.setPhoto(artwork: Artwork(id: "p1", status: "draft"), candidates: [one, two], imageSize: size)
    flow.pieceCandidateId = "c1"
    flow.pieceArtwork = Artwork(id: "p1", cleanedUrl: "u")
    flow.changedArtwork = Artwork(id: "ch1", parentArtworkId: "p1")
    flow.changeInstruction = "Make it red"
    flow.resetCutout(artwork: Artwork(id: "ch1"), candidates: [one, two], imageSize: size)
    flow.selectedCandidateIds = ["c1"]
    flow.points = [CutoutPoint(x: 1, y: 2, label: .positive)]
    flow.box = [0, 0, 10, 10]
    flow.discardPhoto()
    XCTAssertNil(flow.photo)
    XCTAssertNil(flow.photoArtwork)
    XCTAssertTrue(flow.photoCandidates.isEmpty)
    XCTAssertNil(flow.pieceCandidateId)
    XCTAssertNil(flow.pieceArtwork)
    XCTAssertNil(flow.changedArtwork)
    XCTAssertEqual(flow.changeInstruction, "")
    XCTAssertNil(flow.cutoutArtwork)
    XCTAssertTrue(flow.candidates.isEmpty)
    XCTAssertTrue(flow.selectedCandidateIds.isEmpty)
    XCTAssertTrue(flow.points.isEmpty)
    XCTAssertNil(flow.box)
    XCTAssertNil(flow.imageSize)
  }

  // MARK: T114: photo first, Change it

  /// A new photo: a single drawing starts picked; several wait for a choice; earlier changes go.
  func testSetPhotoPicksTheOnlyDrawingAndDropsChanges() {
    let flow = CreateFlow()
    flow.changedArtwork = Artwork(id: "ch1")
    flow.changeInstruction = "x"
    flow.setPhoto(artwork: Artwork(id: "p1"), candidates: [one], imageSize: size)
    XCTAssertEqual(flow.pieceCandidateId, "c1")
    XCTAssertNil(flow.changedArtwork)
    XCTAssertEqual(flow.changeInstruction, "")
    flow.setPhoto(artwork: Artwork(id: "p2"), candidates: [one, two], imageSize: size)
    XCTAssertNil(flow.pieceCandidateId)
    XCTAssertEqual(flow.photoImageSize, size)
  }

  /// The art on screen is the latest change, else the picked drawing; "Back to my original" is
  /// only a local switch.
  func testCurrentArtFollowsTheChange() {
    let flow = CreateFlow()
    flow.pieceArtwork = Artwork(id: "p1", cleanedUrl: "u")
    XCTAssertEqual(flow.currentArt?.id, "p1")
    flow.changeBase = flow.pieceArtwork
    flow.changedArtwork = Artwork(id: "ch1", parentArtworkId: "p1")
    XCTAssertEqual(flow.currentArt?.id, "ch1")
    flow.resetChange()
    XCTAssertEqual(flow.currentArt?.id, "p1")
    XCTAssertNil(flow.changeBase)
  }

  /// Choose a pattern: a tap on the photo picks the smallest drawing under it.
  @MainActor
  func testTapOnThePhotoPicksTheDrawingUnderIt() {
    let outer = Candidate(id: "big", bbox: [0, 0, 1000, 1000])
    let inner = Candidate(id: "small", bbox: [100, 100, 300, 300])
    XCTAssertEqual(ChoosePatternView.candidate(at: CGPoint(x: 200, y: 200), in: [outer, inner])?.id, "small")
    XCTAssertEqual(ChoosePatternView.candidate(at: CGPoint(x: 600, y: 600), in: [outer, inner])?.id, "big")
    XCTAssertNil(ChoosePatternView.candidate(at: CGPoint(x: 2000, y: 10), in: [outer, inner]))
  }

  /// My designs hides changes that were never cut out.
  func testDesignsHideUncutChanges() {
    let shown = DesignsStore.shown([
      Artwork(id: "p1", cleanedUrl: "u"),
      Artwork(id: "ch1", parentArtworkId: "p1"),
      Artwork(id: "ch2", cleanedUrl: "u2", parentArtworkId: "p1"),
      Artwork(id: "ch3", parentArtworkId: "p1", lastError: "x"),
    ])
    XCTAssertEqual(shown.map(\.id), ["p1", "ch2"], "a change with a parent and no cut-out is hidden, failed or not")
  }

  // MARK: T114 fix round 1: draft reuse, VoiceOver targets, whole photo

  /// Back from Listing details, then Use this again: the same cut reuses the draft; a re-cut
  /// refreshes it; another artwork or type makes a new product.
  func testProductPlanReusesRefreshesOrCreates() {
    let flow = CreateFlow()
    let cut = Artwork(id: "ch1", cleanedUrl: "cut-1")
    XCTAssertEqual(flow.productPlan(for: cut, type: .sticker), .create, "nothing made yet")
    let draft = Product(id: "pr1", artworkId: "ch1", type: .sticker, mockupUrl: "mock-1", priceCents: 500, status: "draft")
    flow.useProduct(draft, madeFrom: cut)
    XCTAssertEqual(flow.productPlan(for: cut, type: .sticker), .reuse(draft), "same cut: no second draft")
    XCTAssertEqual(flow.productPlan(for: Artwork(id: "ch1", cleanedUrl: "cut-2"), type: .sticker), .refresh(draft), "re-cut: read it again")
    XCTAssertEqual(flow.productPlan(for: cut, type: .tote), .create)
    XCTAssertEqual(flow.productPlan(for: Artwork(id: "p1", cleanedUrl: "cut-1"), type: .sticker), .create)
    flow.discardPhoto()
    XCTAssertNil(flow.product)
    XCTAssertNil(flow.productCut)
  }

  /// A refreshed draft takes the rebuilt mockup and price from `GET /artworks`; missing → unchanged.
  func testRefreshedDraftTakesTheRebuiltMockup() {
    let draft = Product(id: "pr1", artworkId: "ch1", type: .sticker, mockupUrl: "mock-1", priceCents: 500, status: "draft")
    let list = [Artwork(id: "ch1", products: [ArtworkProduct(id: "pr1", type: .sticker, status: "draft", priceCents: 600, mockupUrl: "mock-2")])]
    let fresh = CreateFlow.refreshed(draft, in: list)
    XCTAssertEqual(fresh.mockupUrl, "mock-2")
    XCTAssertEqual(fresh.priceCents, 600)
    XCTAssertEqual(CreateFlow.refreshed(draft, in: []), draft, "not in the list: kept as it was")
  }

  /// A re-cut whose product rebuild failed leaves the notice Listing details shows.
  func testFailedRebuildLeavesTheNotice() {
    let flow = CreateFlow()
    flow.cutoutArtwork = Artwork(id: "ch1", cleanedUrl: "cut-1", altText: "A bus")
    flow.recordCut(CleanupResult(artwork: Artwork(id: "ch1", cleanedUrl: "cut-2"), failedProductIds: ["pr1"]))
    XCTAssertEqual(flow.artwork?.cleanedUrl, "cut-2")
    XCTAssertEqual(flow.cutoutArtwork?.altText, "A bus", "the description is kept")
    XCTAssertNotNil(flow.cutoutNotice)
    XCTAssertTrue(flow.cutoutNotice?.contains("could not be rebuilt") == true)
    flow.recordCut(CleanupResult(artwork: Artwork(id: "ch1", cleanedUrl: "cut-3")))
    XCTAssertNil(flow.cutoutNotice, "a clean re-cut clears it")
  }

  /// The VoiceOver actions act on the piece, or on the whole photo when no drawing was found.
  func testAccessTargetsPieceOrWholePhoto() throws {
    let onPiece = try XCTUnwrap(CutoutRequest.accessTarget(piece: one, image: size))
    XCTAssertEqual(onPiece.box, one.bbox)
    XCTAssertEqual(onPiece.point, CutoutPoint(x: 300, y: 426.5, label: .positive))
    let whole = try XCTUnwrap(CutoutRequest.accessTarget(piece: nil, image: size))
    XCTAssertEqual(whole.box, [0, 0, 1200, 1600])
    XCTAssertEqual(whole.point, CutoutPoint(x: 600, y: 800, label: .positive))
    XCTAssertNil(CutoutRequest.accessTarget(piece: nil, image: nil))
  }

  /// No drawing found and nothing marked: "Use this" sends the whole photo; never once a cut exists.
  func testWholePhotoOnlyWithoutACutOrPiece() {
    XCTAssertEqual(CutoutRequest.wholePhoto(hasCut: false, selected: [], image: size), CleanupRequest(box: [0, 0, 1200, 1600]))
    XCTAssertNil(CutoutRequest.wholePhoto(hasCut: true, selected: [], image: size))
    XCTAssertNil(CutoutRequest.wholePhoto(hasCut: false, selected: [one], image: size))
    XCTAssertNil(CutoutRequest.wholePhoto(hasCut: false, selected: [], image: nil))
  }
}

