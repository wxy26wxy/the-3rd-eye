import XCTest
@testable import The3rdEye

/// Feedback round 2 (T122): Listing details' drafting state, which picture creator screens show, and
/// the story video row and captions.
@MainActor
final class ListingStoryTests: XCTestCase {
  // MARK: Drafting (R5)

  func testDraftingReplacesTheForm() {
    XCTAssertEqual(ListingPhase.of(creatingProduct: true, drafting: true), .makingProduct)
    XCTAssertEqual(ListingPhase.of(creatingProduct: false, drafting: true), .drafting)
    XCTAssertEqual(ListingPhase.of(creatingProduct: false, drafting: false), .form)
    XCTAssertFalse(ListingPhase.drafting.showsFields)
    XCTAssertFalse(ListingPhase.makingProduct.showsFields)
    XCTAssertTrue(ListingPhase.form.showsFields)
  }

  func testApproveOnlyOnAFilledForm() {
    XCTAssertFalse(ListingPhase.drafting.canApprove(approving: false, title: "Frog", priceCents: 500), "never while drafting")
    XCTAssertFalse(ListingPhase.makingProduct.canApprove(approving: false, title: "Frog", priceCents: 500))
    XCTAssertTrue(ListingPhase.form.canApprove(approving: false, title: "Frog", priceCents: 500))
    XCTAssertFalse(ListingPhase.form.canApprove(approving: true, title: "Frog", priceCents: 500))
    XCTAssertFalse(ListingPhase.form.canApprove(approving: false, title: "  ", priceCents: 500))
    XCTAssertFalse(ListingPhase.form.canApprove(approving: false, title: "Frog", priceCents: 0))
  }

  // MARK: Pictures (R1)

  private let art = Artwork(id: "a1", cleanedUrl: "https://x/cut.png", previewUrl: "https://x/edit.png")

  func testStickerShowsItsBorderedPreviewNeverTheMockup() {
    let product = Product(id: "p1", type: .sticker, mockupUrl: "https://x/mock.png", previewUrl: "https://x/preview.png")
    XCTAssertEqual(ProductPicture.url(type: .sticker, product: product, artwork: art)?.absoluteString, "https://x/preview.png")
    let older = Product(id: "p1", type: .sticker, mockupUrl: "https://x/mock.png")
    XCTAssertEqual(ProductPicture.url(type: .sticker, product: older, artwork: art)?.absoluteString, "https://x/cut.png",
                   "no preview yet: the cut-out, not the mockup")
  }

  /// T131 (user ruling): a tote bag shows its AI mockup again; without one, the art.
  func testToteShowsItsMockup() {
    let tote = Product(id: "p2", type: .tote, mockupUrl: "https://x/mock.png", previewUrl: nil)
    XCTAssertEqual(ProductPicture.url(type: .tote, product: tote, artwork: art)?.absoluteString, "https://x/mock.png")
    XCTAssertEqual(ProductPicture.url(type: .tote, product: tote, artwork: nil)?.absoluteString, "https://x/mock.png")
    let early = Product(id: "p2", type: .tote, mockupUrl: nil)
    XCTAssertEqual(ProductPicture.url(type: .tote, product: early, artwork: art)?.absoluteString, "https://x/cut.png", "no mockup yet: the art")
  }

  func testDesignTilePrefersTheShopStickersPreview() {
    var design = Artwork(id: "d1", cleanedUrl: "https://x/cut.png")
    XCTAssertEqual(design.creatorPictureURL?.absoluteString, "https://x/cut.png")
    design.products = [
      ArtworkProduct(id: "t", type: .tote, status: "published", mockupUrl: "https://x/tote-mock.png"),
      ArtworkProduct(id: "s1", type: .sticker, status: "draft", previewUrl: "https://x/draft.png"),
      ArtworkProduct(id: "s2", type: .sticker, status: "published", previewUrl: "https://x/live.png"),
      ArtworkProduct(id: "s3", type: .sticker, status: "archived", previewUrl: "https://x/old.png"),
    ]
    XCTAssertEqual(design.creatorPictureURL?.absoluteString, "https://x/live.png")
    design.products = [ArtworkProduct(id: "t", type: .tote, status: "published", mockupUrl: "https://x/tote-mock.png")]
    XCTAssertEqual(design.creatorPictureURL?.absoluteString, "https://x/tote-mock.png", "a tote alone: its mockup (T131)")
    design.products = [ArtworkProduct(id: "t1", type: .tote, status: "draft", mockupUrl: "https://x/draft-tote.png"),
                       ArtworkProduct(id: "t2", type: .tote, status: "published", mockupUrl: "https://x/live-tote.png"),
                       ArtworkProduct(id: "t3", type: .tote, status: "archived", mockupUrl: "https://x/old-tote.png")]
    XCTAssertEqual(design.creatorPictureURL?.absoluteString, "https://x/live-tote.png", "the tote in the shop first")
    design.products = [ArtworkProduct(id: "t", type: .tote, status: "published", title: "Older server")]
    XCTAssertEqual(design.creatorPictureURL?.absoluteString, "https://x/cut.png", "no mockup: the art")
  }

  func testPreviewUrlDecodesOnProducts() throws {
    let json = #"{"id":"p1","type":"sticker","previewUrl":"https://x/p.png","mockupUrl":null}"#
    XCTAssertEqual(try JSONDecoder().decode(Product.self, from: Data(json.utf8)).previewUrl, "https://x/p.png")
    XCTAssertEqual(try JSONDecoder().decode(ArtworkProduct.self, from: Data(json.utf8)).previewUrl, "https://x/p.png")
    XCTAssertNil(try JSONDecoder().decode(Product.self, from: Data(#"{"id":"p2","previewUrl":null}"#.utf8)).previewUrl)
  }

  // MARK: Story video (R6)

  func testStoryRowStates() throws {
    XCTAssertEqual(StoryVideoState.of(nil), .none)
    XCTAssertEqual(StoryVideoState.of(Creator(id: "c", storyVideoUrl: "")), .none)
    let state = StoryVideoState.of(Creator(id: "c", storyVideoUrl: "creators/c/story-video/v 1.mp4"))
    let url = try XCTUnwrap(state.url)
    XCTAssertTrue(url.path.hasSuffix("/media/creators/c/story-video/v 1.mp4"), "served through /media")
    XCTAssertEqual(StoryVideoState.of(Creator(id: "c", storyVideoUrl: "https://blob/v.mp4")).url?.absoluteString, "https://blob/v.mp4")
    XCTAssertEqual(StoryVideoState.none.detail(recorded: nil), "No story video yet")
    XCTAssertEqual(state.detail(recorded: nil), "Recorded")
    let date = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-11-02T12:00:00Z"))
    XCTAssertTrue(state.detail(recorded: date).hasPrefix("Recorded "))
    XCTAssertTrue(state.detail(recorded: date).contains("2026"))
  }

  func testCaptionsFollowThePlayhead() {
    let vtt = "WEBVTT\n\n1\n00:00.000 --> 00:02.000 align:center\nHi, I am <b>Test</b> Artist.\n\n00:00:02.000 --> 00:00:04,500\nI draw frogs\nwith crowns.\n\nbroken --> x\nnope\n"
    let captions = Captions(vtt: vtt)
    XCTAssertEqual(captions.cues.count, 2)
    XCTAssertEqual(captions.text(at: 0.5), "Hi, I am Test Artist.")
    XCTAssertEqual(captions.text(at: 3), "I draw frogs with crowns.")
    XCTAssertEqual(captions.cues[1].end, 4.5, accuracy: 0.001)
    XCTAssertNil(captions.text(at: 9))
    XCTAssertTrue(Captions(vtt: nil).cues.isEmpty)
    XCTAssertTrue(Captions(vtt: "WEBVTT\n").cues.isEmpty)
  }

  func testStoryScreensDoNotCountAsACreation() {
    let app = AppState(api: APIClient(baseURL: URL(string: "http://localhost/api/v1")!, transport: StubTransport(body: "{}"), token: nil))
    app.createPath = [.storyLibrary, .recordStoryAgain]
    XCTAssertFalse(app.hasCreationInProgress, "watching or re-recording the story video replaces nothing")
    app.createPath = [.chooseMethod]
    XCTAssertTrue(app.hasCreationInProgress)
  }
}

/// Ruling (T122): every photo goes through Adjust the area before Change it.
@MainActor
final class AdjustAreaRouteTests: XCTestCase {
  private let size = ImageSize(w: 1200, h: 1600)
  private let one = Candidate(id: "c1", bbox: [100, 160, 500, 693])
  private let two = Candidate(id: "c2", bbox: [660, 896, 1060, 1429])

  /// T131: the auto-cut piece skips Choose a pattern but is still cut with the frame (the server's
  /// own cut is not clipped to it).
  func testAutoCutPieceSkipsChooseAPatternButIsCutWithTheFrame() {
    let flow = CreateFlow()
    let cut = Artwork(id: "p1", cleanedUrl: "https://x/cut.png")
    flow.setPhoto(artwork: cut, candidates: [one], imageSize: size)
    XCTAssertEqual(flow.routeAfterFinding(artwork: cut), .adjustArea)
    XCTAssertEqual(flow.pieceCandidateId, "c1")
    XCTAssertNil(flow.pieceArtwork, "no cut of ours yet")
    let request = CutoutRequest.make(piece: one, area: AreaFrame.initial(piece: one, image: size))
    XCTAssertEqual(flow.routeAfterArea(request), .makingCutout(.area(request)), "Use this area unchanged still cuts")
  }

  func testNoDrawingGoesStraightToTheFrame() {
    let flow = CreateFlow()
    let photo = Artwork(id: "p1")
    flow.setPhoto(artwork: photo, candidates: [], imageSize: size)
    XCTAssertEqual(flow.routeAfterFinding(artwork: photo), .adjustArea)
    XCTAssertNil(flow.pieceArtwork)
  }

  func testSeveralDrawingsOrAnUncutOneAreChosenFirst() {
    let flow = CreateFlow()
    let photo = Artwork(id: "p1")
    flow.setPhoto(artwork: photo, candidates: [one, two], imageSize: size)
    XCTAssertEqual(flow.routeAfterFinding(artwork: photo), .choosePattern)
    flow.setPhoto(artwork: photo, candidates: [one], imageSize: size)
    XCTAssertEqual(flow.routeAfterFinding(artwork: photo), .choosePattern, "one drawing not cut yet: Choose a pattern shows it picked")
    XCTAssertNil(flow.pieceArtwork)
  }
}
