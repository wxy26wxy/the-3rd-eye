import UIKit
import XCTest
@testable import The3rdEye

/// Records the background-task scopes opened and closed.
@MainActor
final class RecordingBackgroundHost: BackgroundTaskHost {
  private(set) var begun: [String] = []
  private(set) var ended: [UIBackgroundTaskIdentifier] = []
  private(set) var expirations: [() -> Void] = []
  private var next = 1

  func begin(name: String, expiration: @escaping () -> Void) -> UIBackgroundTaskIdentifier {
    begun.append(name)
    expirations.append(expiration)
    defer { next += 1 }
    return UIBackgroundTaskIdentifier(rawValue: next)
  }

  func end(_ identifier: UIBackgroundTaskIdentifier) { ended.append(identifier) }
}

private struct Boom: Error {}

/// Round 3 (T136): background-safe calls, print check messages, the listing's Redo.
@MainActor
final class RoundThreeTests: XCTestCase {
  private let base = URL(string: "http://localhost:3000/api/v1")!
  private var savedHost: BackgroundTaskHost?

  override func setUp() async throws {
    savedHost = BackgroundWork.host
  }

  override func tearDown() async throws {
    BackgroundWork.host = savedHost
  }

  // MARK: Background scope (ruling 6)

  func testScopeBeginsAndEndsAroundTheCall() async throws {
    let host = RecordingBackgroundHost()
    let value = try await BackgroundWork.run("change", host: host) { () async throws -> Int in
      XCTAssertEqual(host.begun, ["change"], "open while the call runs")
      XCTAssertTrue(host.ended.isEmpty)
      return 7
    }
    XCTAssertEqual(value, 7)
    XCTAssertEqual(host.ended, [UIBackgroundTaskIdentifier(rawValue: 1)])
  }

  func testScopeEndsWhenTheCallThrows() async {
    let host = RecordingBackgroundHost()
    do {
      _ = try await BackgroundWork.run("products", host: host) { () async throws -> Int in throw Boom() }
      XCTFail("the error goes on to the caller")
    } catch {
      XCTAssertTrue(error is Boom)
    }
    XCTAssertEqual(host.begun, ["products"])
    XCTAssertEqual(host.ended.count, 1)
  }

  func testTimeRunningOutEndsTheScopeOnce() async throws {
    let host = RecordingBackgroundHost()
    _ = try await BackgroundWork.run("detect", host: host) { () async throws -> Int in
      host.expirations.first?()
      XCTAssertEqual(host.ended.count, 1, "ended when iOS says the time is up")
      return 1
    }
    XCTAssertEqual(host.ended.count, 1, "not ended a second time when the call returns")
  }

  func testLongCallsOpenAScope() async throws {
    let host = RecordingBackgroundHost()
    BackgroundWork.host = host
    let stub = StubTransport(status: 201, body: Fixtures.change)
    let api = APIClient(baseURL: base, transport: stub, token: "t0k")
    _ = try await api.change(artworkId: "p1", instruction: "Purple", transcript: nil, clientRequestId: "req-1")
    stub.status = 500
    stub.body = #"{"error":{"code":"internal","message":"nope"}}"#
    _ = try? await api.createProduct(artworkId: "p1", type: .sticker, clientRequestId: "req-2")
    XCTAssertEqual(host.begun, ["change", "products"])
    XCTAssertEqual(host.ended.count, 2, "closed on the error too")
    _ = try? await api.myArtworks()
    XCTAssertEqual(host.begun.count, 2, "short calls open none")
  }

  // MARK: Idempotency ids

  func testChangeAndProductsSendTheirRequestId() async throws {
    BackgroundWork.host = RecordingBackgroundHost()
    let stub = StubTransport(status: 201, body: Fixtures.change)
    let api = APIClient(baseURL: base, transport: stub, token: "t0k")
    _ = try await api.change(artworkId: "p1", instruction: "Purple", transcript: nil, clientRequestId: "req-1")
    let change = try JSONSerialization.jsonObject(with: stub.requests[0].httpBody!) as? [String: Any]
    XCTAssertEqual(change?["clientRequestId"] as? String, "req-1")
    stub.body = #"{"id":"pr1","artworkId":"p1","type":"sticker","clientRequestId":"req-2"}"#
    let product = try await api.createProduct(artworkId: "p1", type: .sticker, clientRequestId: "req-2")
    let sent = try JSONSerialization.jsonObject(with: stub.requests[1].httpBody!) as? [String: Any]
    XCTAssertEqual(sent?["clientRequestId"] as? String, "req-2")
    XCTAssertEqual(product.clientRequestId, "req-2")
  }

  // MARK: Print check (ruling 2)

  func testApproveRefusalSaysWhichCheckRefused() async throws {
    BackgroundWork.host = RecordingBackgroundHost()
    let stub = StubTransport(status: 409, body: #"{"error":{"code":"print_check_failed","message":"contrast 12","check":"contrast"}}"#)
    let api = APIClient(baseURL: base, transport: stub, token: "t0k")
    do {
      _ = try await api.approveListing(productId: "pr1", via: "tap", edits: nil)
      XCTFail("refused")
    } catch let refused as PrintCheckFailed {
      XCTAssertEqual(refused.check, .contrast)
      XCTAssertTrue(refused.canUseAnyway)
      XCTAssertTrue(APIError.approveMessage(for: refused).contains("faint"))
    }
    let first = try JSONSerialization.jsonObject(with: stub.requests[0].httpBody!) as? [String: Any]
    XCTAssertNil(first?["acceptPrintWarning"], "not sent unless accepted")

    stub.body = #"{"error":{"code":"print_check_failed","message":"too small","check":"resolution"}}"#
    do {
      _ = try await api.approveListing(productId: "pr1", via: "tap", edits: nil, acceptPrintWarning: true)
      XCTFail("refused")
    } catch let refused as PrintCheckFailed {
      XCTAssertEqual(refused.check, .resolution)
      XCTAssertFalse(refused.canUseAnyway, "a resolution failure cannot be accepted")
      XCTAssertTrue(APIError.approveMessage(for: refused).contains("too small to print sharply"))
    }
    let second = try JSONSerialization.jsonObject(with: stub.requests[1].httpBody!) as? [String: Any]
    XCTAssertEqual(second?["acceptPrintWarning"] as? Bool, true)
  }

  func testOlderPrintRefusalKeepsTheGeneralMessage() {
    let old = APIError.server(status: 409, code: "print_check_failed", message: "contrast")
    XCTAssertTrue(APIError.approveMessage(for: old).contains("won't print well"))
    XCTAssertTrue(APIError.approveMessage(for: PrintCheckFailed(check: nil, message: "x")).contains("won't print well"))
  }

  func testRunResultCarriesThePrintCheckLine() throws {
    let json = #"{"title":"Frog","price_cents":500,"print_ok":false,"print_check":"contrast"}"#
    let draft = try JSONDecoder().decode(ListingDraft.self, from: Data(json.utf8))
    XCTAssertEqual(draft.printCheck, .contrast)
    XCTAssertEqual(ListingDetailsView.printLine(draft.printCheck), "Print check: the colors may look faint")
    XCTAssertEqual(ListingDetailsView.printLine(.resolution), "Print check: might print blurry")
    XCTAssertNil(ListingDetailsView.printLine(nil))
    let older = try JSONDecoder().decode(ListingDraft.self, from: Data(#"{"title":"Frog","print_check":"glow"}"#.utf8))
    XCTAssertNil(older.printCheck, "an unknown check is not shown")
  }

  // MARK: Redo (ruling 5)

  func testRedoGoesBackToTheCutoutOfTheProductsArtKeepingTheDraft() {
    let app = AppState(api: APIClient(baseURL: base, transport: StubTransport(body: "{}"), token: nil))
    let flow = app.flow
    flow.setPhoto(artwork: Artwork(id: "p1"), candidates: [], imageSize: ImageSize(w: 100, h: 100))
    let cut = Artwork(id: "p1", cleanedUrl: "https://x/cut.png")
    flow.recordCut(of: "p1", cut, request: CleanupRequest(box: [0, 0, 100, 100], clipToBox: true))
    flow.artwork = cut
    flow.useProduct(Product(id: "pr1", artworkId: "p1", type: .sticker), madeFrom: cut)
    app.createPath = [.chooseMethod, .camera(.camera), .adjustArea, .yourCutout("p1"), .changeIt, .listingDetails]
    app.backToCutout()
    XCTAssertEqual(app.createPath.last, .yourCutout("p1"))
    XCTAssertEqual(app.createPath.count, 4)
    XCTAssertEqual(flow.productPlan(for: cut, type: .sticker), .reuse(Product(id: "pr1", artworkId: "p1", type: .sticker)),
                   "Use this again reuses the draft")
  }

  func testRedoFromASavedDesignOpensItsCutout() {
    let app = AppState(api: APIClient(baseURL: base, transport: StubTransport(body: "{}"), token: nil))
    let design = Artwork(id: "d1", cleanedUrl: "https://x/d1.png")
    app.continueFrom(artwork: design, productType: .sticker)
    app.backToCutout()
    XCTAssertEqual(app.createPath, [.yourCutout("d1")])
    XCTAssertEqual(app.flow.cut(for: "d1")?.artwork.id, "d1")
    XCTAssertEqual(app.flow.routeAfterCutout(of: "d1"), .makingProduct)
  }

  // MARK: Reconcile (ruling 6)

  private let started = ISO8601DateFormatter().date(from: "2026-11-03T10:00:00Z")!

  private func child(_ id: String, base: String = "p1", instruction: String = "Purple sky", at created: String, rid: String? = nil) -> Artwork {
    Artwork(id: id, parentArtworkId: base, changeInstruction: instruction, createdAt: created, clientRequestId: rid)
  }

  func testRecoveredChangeIsTheChildMadeAfterTheJobStarted() {
    let job = PendingJob(kind: .change(baseId: "p1", instruction: "Purple sky"), startedAt: started, clientRequestId: "r1")
    let artworks = [
      Artwork(id: "p1"),
      child("old", at: "2026-11-03T09:00:00.000Z"),
      child("other", instruction: "Red sky", at: "2026-11-03T10:00:30.000Z"),
      child("elsewhere", base: "p9", at: "2026-11-03T10:00:30.000Z"),
      child("ch2", at: "2026-11-03T10:00:40.000Z"),
      child("ch3", at: "2026-11-03T10:00:50Z"),
    ]
    XCTAssertEqual(CreateFlow.recoveredChange(in: artworks, job: job)?.id, "ch3", "the newest matching child after the start")
    XCTAssertNil(CreateFlow.recoveredChange(in: Array(artworks.prefix(4)), job: job), "an earlier child of the same request is not it")
    let exact = artworks + [child("chX", at: "2026-11-03T08:00:00.000Z", rid: "r1")]
    XCTAssertEqual(CreateFlow.recoveredChange(in: exact, job: job)?.id, "chX", "its clientRequestId wins")
    let skew = [child("ch4", at: "2026-11-03T09:59:00.000Z")]
    XCTAssertEqual(CreateFlow.recoveredChange(in: skew, job: job)?.id, "ch4", "a minute of clock difference is allowed")
    // Review I4: the same instruction asked again a minute earlier made ch5 with its own id.
    let earlierAttempt = [child("ch5", at: "2026-11-03T10:00:20.000Z", rid: "r0")]
    XCTAssertNil(CreateFlow.recoveredChange(in: earlierAttempt, job: job), "another attempt's child is not this answer")
  }

  /// Review I2: a product the artwork already had (Make another sticker next to a published one)
  /// is never taken for the lost answer.
  func testRecoveredProductIsNeverOneKnownAtTheStart() {
    let job = PendingJob(kind: .product(artworkId: "d1", type: .sticker), startedAt: started, clientRequestId: "r2",
                         knownProductIds: ["live"])
    var art = Artwork(id: "d1", cleanedUrl: "u")
    art.products = [ArtworkProduct(id: "live", type: .sticker, status: "published")]
    XCTAssertNil(CreateFlow.recoveredProduct(in: [art], job: job), "the published sticker is not the new one")
    art.products = [ArtworkProduct(id: "new", type: .sticker, status: "draft"), ArtworkProduct(id: "live", type: .sticker, status: "published")]
    XCTAssertEqual(CreateFlow.recoveredProduct(in: [art], job: job)?.id, "new")
    let flow = CreateFlow()
    XCTAssertEqual(flow.knownProductIds(of: art), ["new", "live"])
  }

  /// Review I2: a lost `products` answer is asked again with the same request id (the server answers
  /// the product it made), before any scan of the list.
  func testProductRecoverySendsTheSameRequestAgain() async throws {
    BackgroundWork.host = RecordingBackgroundHost()
    let stub = StubTransport(status: 200, body: #"{"id":"pr9","artworkId":"d1","type":"sticker","clientRequestId":"r2"}"#)
    let api = APIClient(baseURL: base, transport: stub, token: "t0k")
    let job = PendingJob(kind: .product(artworkId: "d1", type: .sticker), startedAt: started, clientRequestId: "r2", knownProductIds: ["live"])
    guard case .product(let product)? = await CreateFlow.reconcile(job, api: api) else { return XCTFail("the product") }
    XCTAssertEqual(product.id, "pr9")
    XCTAssertEqual(stub.requests.count, 1)
    XCTAssertEqual(stub.requests[0].url?.path, "/api/v1/products")
    let sent = try JSONSerialization.jsonObject(with: stub.requests[0].httpBody!) as? [String: Any]
    XCTAssertEqual(sent?["clientRequestId"] as? String, "r2")
  }

  /// Review I3: the draft that was on screen when the run started is not its answer.
  func testRecoveredListingMustDifferFromWhatWasShown() {
    let job = PendingJob(kind: .listing(productId: "pr1"), startedAt: started, clientRequestId: "r5",
                         shownListing: PendingJob.ShownListing(title: "Old Frog", description: "Old words"))
    XCTAssertFalse(CreateFlow.recoveredListing(ListingDraft(title: "Old Frog", description: "Old words"), job: job))
    XCTAssertTrue(CreateFlow.recoveredListing(ListingDraft(title: "New Frog", description: "Old words"), job: job))
    XCTAssertTrue(CreateFlow.recoveredListing(ListingDraft(title: "Old Frog", description: "New words"), job: job))
    XCTAssertFalse(CreateFlow.recoveredListing(ListingDraft(title: " "), job: job))
  }

  func testANewPhotoOrPieceDropsTheJobInFlight() {
    let flow = CreateFlow()
    _ = flow.startJob(.change(baseId: "p1", instruction: "x"))
    flow.resetChange()
    XCTAssertNil(flow.pendingJob)
    _ = flow.startJob(.listing(productId: "pr1"))
    flow.setPhoto(artwork: Artwork(id: "p2"), candidates: [], imageSize: nil)
    XCTAssertNil(flow.pendingJob)
  }

  /// Review I5: Making your cutout back on screen with its cut already made sends nothing.
  func testCutJobDoneIsNotSentAgain() {
    let flow = CreateFlow()
    flow.setPhoto(artwork: Artwork(id: "p1"), candidates: [], imageSize: ImageSize(w: 100, h: 100))
    let box: [Double] = [0, 0, 100, 100]
    XCTAssertFalse(MakingCutoutView.isDone(.detect(box), in: flow))
    flow.recordDetect(DetectResponse(artwork: Artwork(id: "p1", cleanedUrl: "c"), candidates: [], imageSize: nil), box: box)
    XCTAssertTrue(MakingCutoutView.isDone(.detect(box), in: flow))
    XCTAssertFalse(MakingCutoutView.isDone(.detect([0, 0, 50, 50]), in: flow), "a new frame is a new job")
    XCTAssertFalse(MakingCutoutView.isDone(.change("ch1"), in: flow))
    flow.changeCuts["ch1"] = Cut(artwork: Artwork(id: "ch1", cleanedUrl: "x"), candidates: [], imageSize: nil, selected: [], box: nil)
    XCTAssertTrue(MakingCutoutView.isDone(.change("ch1"), in: flow))
    XCTAssertEqual(MakingCutoutView.target(of: .detect(box), in: flow), "p1")
  }

  /// Review I1: "Re-do the cutout" after a resolution refusal goes back to the frame.
  func testResolutionRedoGoesBackToTheFrame() async throws {
    let stub = StubTransport(body: "{}")
    let app = AppState(api: APIClient(baseURL: base, transport: stub, token: nil))
    app.flow.artwork = Artwork(id: "p1", cleanedUrl: "c")
    app.createPath = [.chooseMethod, .camera(.library), .adjustArea, .yourCutout("p1"), .changeIt, .listingDetails]
    try await app.backToArea()
    XCTAssertTrue(stub.requests.isEmpty, "no call: the frame is in the path")
    XCTAssertEqual(app.createPath.last, .adjustArea)
    XCTAssertEqual(app.createPath.count, 3)
  }

  func testResolutionRedoOnASavedDesignOpensItsFrame() async throws {
    BackgroundWork.host = RecordingBackgroundHost()
    let detail = #"{"artwork":{"id":"d2","cleanedUrl":"https://x/d2.png"},"candidates":[{"id":"c1","bbox":[0,0,10,10]}],"imageSize":{"w":1200,"h":1600},"originalUrl":"https://x/o.png"}"#
    let stub = StubTransport(body: detail)
    let app = AppState(api: APIClient(baseURL: base, transport: stub, token: "t0k"))
    app.continueFrom(artwork: Artwork(id: "d2", cleanedUrl: "https://x/d2.png"), productType: .sticker)
    try await app.backToArea()
    XCTAssertEqual(stub.requests.last?.url?.path, "/api/v1/artworks/d2")
    XCTAssertEqual(app.selectedTab, .designs)
    XCTAssertEqual(app.designsPath, [.detail("d2"), .adjustArea])
    XCTAssertEqual(app.designFlow.cutoutArtwork?.id, "d2")
    XCTAssertEqual(app.designFlow.imageSize, ImageSize(w: 1200, h: 1600))
    XCTAssertEqual(app.designFlow.productType, .sticker)
  }

  func testRecoveredProductIsOfThatArtworkAndType() {
    let job = PendingJob(kind: .product(artworkId: "p1", type: .sticker), startedAt: started, clientRequestId: "r2")
    var art = Artwork(id: "p1", cleanedUrl: "u")
    art.products = [ArtworkProduct(id: "t1", type: .tote, status: "draft"),
                    ArtworkProduct(id: "s0", type: .sticker, status: "archived"),
                    ArtworkProduct(id: "s1", type: .sticker, status: "draft", priceCents: 500, mockupUrl: "https://x/m.png")]
    let found = CreateFlow.recoveredProduct(in: [Artwork(id: "d1"), art], job: job)
    XCTAssertEqual(found?.id, "s1")
    XCTAssertEqual(found?.artworkId, "p1")
    XCTAssertEqual(found?.mockupUrl, "https://x/m.png")
    XCTAssertNil(CreateFlow.recoveredProduct(in: [Artwork(id: "p1")], job: job))
  }

  func testRecoveredCutIsANewCutOut() {
    let detect = PendingJob(kind: .cut(artworkId: "p1", previousCut: "https://x/old.png", needsCandidates: true), startedAt: started, clientRequestId: "r3")
    let one = Candidate(id: "c1", bbox: [0, 0, 10, 10])
    XCTAssertTrue(CreateFlow.recoveredCut(ArtworkDetailResponse(artwork: Artwork(id: "p1", cleanedUrl: "https://x/new.png"), candidates: [one]), job: detect))
    XCTAssertFalse(CreateFlow.recoveredCut(ArtworkDetailResponse(artwork: Artwork(id: "p1", cleanedUrl: "https://x/old.png"), candidates: [one]), job: detect),
                   "the old cut is not the answer")
    XCTAssertFalse(CreateFlow.recoveredCut(ArtworkDetailResponse(artwork: Artwork(id: "p1", cleanedUrl: "https://x/new.png"), candidates: []), job: detect),
                   "detect without drawings is not done")
    let cutout = PendingJob(kind: .cut(artworkId: "ch1", previousCut: nil, needsCandidates: false), startedAt: started, clientRequestId: "r4")
    XCTAssertTrue(CreateFlow.recoveredCut(ArtworkDetailResponse(artwork: Artwork(id: "ch1", cleanedUrl: "c"), candidates: []), job: cutout))
    XCTAssertFalse(CreateFlow.recoveredCut(ArtworkDetailResponse(artwork: Artwork(id: "ch1"), candidates: []), job: cutout))
  }

  func testOneRequestIdPerAttempt() {
    let flow = CreateFlow()
    let first = flow.startJob(.change(baseId: "p1", instruction: "Purple"))
    XCTAssertEqual(flow.startJob(.change(baseId: "p1", instruction: "Purple")).clientRequestId, first.clientRequestId,
                   "Try again after a lost answer keeps the id")
    XCTAssertTrue(flow.finishJob(first))
    XCTAssertFalse(flow.finishJob(first), "a late answer is not applied twice")
    let second = flow.startJob(.change(baseId: "p1", instruction: "Purple"))
    XCTAssertNotEqual(second.clientRequestId, first.clientRequestId, "a new action gets a new id")
    let other = flow.startJob(.product(artworkId: "p1", type: .sticker))
    XCTAssertNotEqual(other.clientRequestId, second.clientRequestId)
    XCTAssertEqual(flow.pendingJob, other)
  }

  func testReturnToTheAppWithAJobInFlightAsksScreensToReconcile() {
    let app = AppState(api: APIClient(baseURL: base, transport: StubTransport(body: "{}"), token: nil))
    app.scenePhaseChanged(.active)
    XCTAssertEqual(app.flow.resumeCount, 0, "nothing in flight")
    _ = app.flow.startJob(.listing(productId: "pr1"))
    app.scenePhaseChanged(.background)
    app.scenePhaseChanged(.active)
    XCTAssertEqual(app.flow.resumeCount, 1)
  }

  func testReconcileReadsTheServer() async throws {
    BackgroundWork.host = RecordingBackgroundHost()
    let stub = StubTransport(body: "{}")
    let api = APIClient(baseURL: base, transport: stub, token: "t0k")
    stub.queue = [(200, #"{"artworks":[{"id":"ch7","parentArtworkId":"p1","changeInstruction":"Purple sky","createdAt":"2026-11-03T10:01:00.000Z","altText":"Purple"}]}"#)]
    let change = PendingJob(kind: .change(baseId: "p1", instruction: "Purple sky"), startedAt: started, clientRequestId: "r1")
    guard case .change(let res)? = await CreateFlow.reconcile(change, api: api) else { return XCTFail("the child") }
    XCTAssertEqual(res.artwork.id, "ch7")
    XCTAssertEqual(res.description?.alt, "Purple")
    XCTAssertEqual(stub.requests.last?.url?.path, "/api/v1/artworks")

    stub.queue = [(200, #"{"product":{"id":"pr1"},"listing":null,"draft":{"title":"Frog","price_cents":500,"print_ok":true,"print_check":null}}"#)]
    guard case .listing(let draft)? = await CreateFlow.reconcile(PendingJob(kind: .listing(productId: "pr1"), startedAt: started, clientRequestId: "r5"), api: api)
    else { return XCTFail("the draft") }
    XCTAssertEqual(draft.title, "Frog")
    XCTAssertEqual(stub.requests.last?.url?.path, "/api/v1/listings/pr1")

    stub.queue = [(200, #"{"product":{"id":"pr1"},"listing":null,"draft":null}"#)]
    let none = await CreateFlow.reconcile(PendingJob(kind: .listing(productId: "pr1"), startedAt: started, clientRequestId: "r5"), api: api)
    XCTAssertNil(none, "nothing written yet")
  }

  // MARK: Backend review rulings

  /// A failed detect keeps the old cut (status ready) and only sets `lastError`: not "Didn't work",
  /// and not a recovered new cut.
  func testLastErrorIsIgnoredWhileTheRowHasACut() {
    let row = Artwork(id: "p1", cleanedUrl: "https://x/old.png", status: "ready", lastError: "Nothing was found inside the frame.")
    XCTAssertEqual(DesignBadge.of(row), .draft)
    let job = PendingJob(kind: .cut(artworkId: "p1", previousCut: "https://x/old.png", needsCandidates: true), startedAt: started, clientRequestId: "r")
    XCTAssertFalse(CreateFlow.recoveredCut(ArtworkDetailResponse(artwork: row, candidates: [Candidate(id: "c1", bbox: [0, 0, 1, 1])]), job: job))
  }

  /// A repeated change answered before it was described: no empty description card; the screen's
  /// own labels stay.
  func testChangeWithoutADescriptionUsesOurCopy() {
    let art = ChangingView.withFallbackCopy(Artwork(id: "ch1", altText: "", spokenDescription: " "))
    XCTAssertNil(art.altText)
    XCTAssertNil(art.spokenDescription)
    XCTAssertNil(art.shownDescription, "no WHAT THE IMAGE SHOWS card")
    XCTAssertEqual(ChangingView.withFallbackCopy(Artwork(id: "ch1", altText: "A bus")).altText, "A bus")
  }
}
