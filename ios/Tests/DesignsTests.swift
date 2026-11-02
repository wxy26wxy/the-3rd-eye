import XCTest
@testable import The3rdEye

/// My designs (T083): tile badges, continuing a saved design to a listing, delete.
@MainActor
final class DesignsTests: XCTestCase {
  private let base = URL(string: "http://localhost:3000/api/v1")!
  private let now = ISO8601DateFormatter().date(from: "2026-10-30T12:00:00Z")!

  private func artwork(cleaned: String? = "https://blob.example/c.png", lastError: String? = nil,
                       createdAt: String = "2026-10-29T09:00:00.000Z", products: [ArtworkProduct] = []) -> Artwork {
    Artwork(id: "d1", cleanedUrl: cleaned, status: cleaned == nil ? "draft" : "ready", createdAt: createdAt,
            lastError: lastError, products: products)
  }

  private func product(_ id: String, _ type: ProductType, _ status: String, title: String? = nil) -> ArtworkProduct {
    ArtworkProduct(id: id, type: type, status: status, title: title)
  }

  // MARK: Design detail primary (T104 fix round 1)

  func testPrimaryActionPerState() {
    XCTAssertEqual(DesignPrimaryAction.of(artwork(products: [product("p1", .sticker, "draft"), product("p2", .tote, "published")])),
                   .shop("p2"), "a live product: its shop page")
    XCTAssertEqual(DesignPrimaryAction.of(artwork()), .make(.sticker), "a cut-out without products: make a sticker")
    XCTAssertEqual(DesignPrimaryAction.of(artwork(products: [product("p1", .sticker, "archived")])), .make(.sticker))
    XCTAssertEqual(DesignPrimaryAction.of(artwork(cleaned: nil, lastError: "timed out")), .redo, "didn't work: re-do the cutout")
    XCTAssertEqual(DesignPrimaryAction.of(artwork(cleaned: nil, createdAt: "2026-10-30T11:58:00Z")), .redo, "still cutting")
    XCTAssertEqual(DesignPrimaryAction.of(artwork(cleaned: nil)), .redo, "needs a cutout")
  }

  // MARK: Badges

  func testBadgeMapping() {
    XCTAssertEqual(DesignBadge.of(artwork(), now: now), .draft, "a cutout without products is a draft")
    XCTAssertEqual(DesignBadge.of(artwork(products: [product("p1", .sticker, "draft")]), now: now), .draft)
    XCTAssertEqual(DesignBadge.of(artwork(products: [product("p1", .sticker, "draft"), product("p2", .tote, "published")]), now: now),
                   .inShop, "any published product puts it in the shop")
    XCTAssertEqual(DesignBadge.of(artwork(cleaned: nil, lastError: "timed out"), now: now), .failed)
    XCTAssertEqual(DesignBadge.of(artwork(cleaned: nil, createdAt: "2026-10-30T11:58:00Z"), now: now), .cuttingOut,
                   "made two minutes ago, no cutout yet, no error")
    XCTAssertEqual(DesignBadge.of(artwork(cleaned: nil, createdAt: "2026-10-29T09:00:00.000Z"), now: now), .needsCutout,
                   "an old row without a cutout does not spin forever")
    XCTAssertEqual(DesignBadge.of(artwork(cleaned: nil, createdAt: "not a date"), now: now), .needsCutout)
    XCTAssertEqual(DesignBadge.of(artwork(products: [product("p1", .sticker, "archived")]), now: now), .draft)
  }

  func testListItemDecodesProductsAndLastError() throws {
    let json = """
    {"artworks":[{"id":"d1","creatorId":"c1","source":"photo","cleanedUrl":null,"status":"draft","lastError":"boom",
      "createdAt":"2026-10-29T09:00:00.000Z",
      "products":[{"id":"p1","type":"sticker","status":"published","title":"Bird","priceCents":800,"description":"A bird.","mockupUrl":"https://blob.example/m.png"},{"id":"p2","type":"tote","status":"draft","title":null}]}]}
    """
    let res = try JSONDecoder().decode(ArtworksResponse.self, from: Data(json.utf8))
    let item = try XCTUnwrap(res.artworks.first)
    XCTAssertEqual(item.lastError, "boom")
    XCTAssertEqual(item.products?.map(\.id), ["p1", "p2"])
    XCTAssertTrue(item.products?[0].isPublished == true)
    XCTAssertEqual(item.products?[0].priceCents, 800)
    XCTAssertEqual(item.products?[0].description, "A bird.")
    XCTAssertNil(item.products?[1].priceCents, "older servers send no price")
    XCTAssertTrue(item.products?[0].hasListing == true)
    XCTAssertFalse(item.products?[1].hasListing == true)
    XCTAssertEqual(DesignBadge.of(item), .inShop)
  }

  // MARK: Continue to listing

  func testContinueFromSetsFlowAndRoute() {
    let app = AppState(api: APIClient(baseURL: base, transport: StubTransport(body: "{}"), token: "t"))
    app.selectedTab = .designs
    app.createPath = [.chooseMethod, .choosePattern, .changeIt]
    app.designsPath = [.detail("d1")]
    let old = app.flow
    let design = artwork(products: [product("p-tote", .tote, "published")])

    app.continueFrom(artwork: design, productType: .sticker)

    XCTAssertEqual(app.selectedTab, .create)
    XCTAssertEqual(app.createPath, [.listingDetails])
    XCTAssertTrue(app.designsPath.isEmpty, "My designs shows the grid when the creator comes back")
    XCTAssertFalse(app.flow === old, "a new creation")
    XCTAssertEqual(app.flow.artwork?.id, "d1")
    XCTAssertEqual(app.flow.productType, .sticker)
    XCTAssertNil(app.flow.product, "no sticker draft to reuse: Listing details makes one")
  }

  func testContinueFromReusesDraftOfThatType() {
    let app = AppState(api: APIClient(baseURL: base, transport: StubTransport(body: "{}"), token: "t"))
    var draft = product("p-tote", .tote, "draft", title: "Bird Tote")
    draft.priceCents = 1800
    draft.description = "A bird on a tote."
    draft.mockupUrl = "https://blob.example/tote.png"
    let design = artwork(products: [product("p-sticker", .sticker, "published"), draft])
    XCTAssertTrue(design.hasPublished(.sticker))
    XCTAssertFalse(design.hasPublished(.tote))

    app.continueFrom(artwork: design, productType: .tote)
    XCTAssertEqual(app.flow.product?.id, "p-tote")
    XCTAssertEqual(app.flow.product?.type, .tote)
    XCTAssertEqual(app.flow.product?.priceCents, 1800, "Listing details starts from the draft's price")
    XCTAssertEqual(app.flow.product?.mockupUrl, "https://blob.example/tote.png")
    XCTAssertEqual(app.flow.productTitle, "Bird Tote")
    XCTAssertEqual(app.flow.productDescription, "A bird on a tote.")

    app.continueFrom(artwork: design, productType: .sticker)
    XCTAssertNil(app.flow.product, "a published sticker is not reused; a new one is made")
  }

  // MARK: Delete

  func testDeleteCallsDeleteAndRemovesTheTile() async throws {
    let stub = StubTransport(body: "{}")
    stub.queue = [
      (200, #"{"artworks":[{"id":"d1","cleanedUrl":"https://blob.example/1.png","products":[]},{"id":"d2","cleanedUrl":null,"products":[]}]}"#),
      (200, #"{"id":"d1","deleted":true,"archivedProductIds":["p1"]}"#),
    ]
    let store = DesignsStore(api: APIClient(baseURL: base, transport: stub, token: "t"))
    await store.load()
    XCTAssertEqual(store.artworks.map(\.id), ["d1", "d2"])

    try await store.delete(id: "d1")

    XCTAssertEqual(store.artworks.map(\.id), ["d2"])
    let request = try XCTUnwrap(stub.requests.last)
    XCTAssertEqual(request.httpMethod, "DELETE")
    XCTAssertEqual(request.url?.path, "/api/v1/artworks/d1")
  }

  func testFailedDeleteKeepsTheTile() async {
    let stub = StubTransport(body: "{}")
    stub.queue = [
      (200, #"{"artworks":[{"id":"d1","products":[]}]}"#),
      (500, #"{"error":{"code":"internal","message":"Server error"}}"#),
    ]
    let store = DesignsStore(api: APIClient(baseURL: base, transport: stub, token: "t"))
    await store.load()
    do {
      try await store.delete(id: "d1")
      XCTFail("expected an error")
    } catch {
      XCTAssertEqual(store.artworks.map(\.id), ["d1"])
    }
  }

  func testDeleteOfAnAlreadyDeletedDesignRemovesTheTile() async throws {
    let stub = StubTransport(body: "{}")
    stub.queue = [
      (200, #"{"artworks":[{"id":"d1","products":[]}]}"#),
      (404, #"{"error":{"code":"not_found","message":"Not found"}}"#),
    ]
    let store = DesignsStore(api: APIClient(baseURL: base, transport: stub, token: "t"))
    await store.load()
    try await store.delete(id: "d1")
    XCTAssertTrue(store.artworks.isEmpty, "a 404 means it is already gone")
  }

  func testListingSavedAndReplaceKeepProducts() async {
    let stub = StubTransport(body: #"{"artworks":[{"id":"d1","cleanedUrl":null,"products":[{"id":"p1","type":"sticker","status":"draft","title":"Old"}]}]}"#)
    let store = DesignsStore(api: APIClient(baseURL: base, transport: stub, token: "t"))
    await store.load()
    store.listingSaved(productId: "p1", title: "New", status: "published")
    XCTAssertEqual(store.artwork(id: "d1")?.products?.first?.title, "New")
    XCTAssertEqual(DesignBadge.of(store.artwork(id: "d1")!), .inShop)

    store.replace(Artwork(id: "d1", cleanedUrl: "https://blob.example/new.png", status: "ready"))
    XCTAssertEqual(store.artwork(id: "d1")?.cleanedUrl, "https://blob.example/new.png")
    XCTAssertEqual(store.artwork(id: "d1")?.products?.count, 1, "a re-cut keeps the products the list knows")
  }

  func testSignOutClearsDesigns() async {
    let stub = StubTransport(body: #"{"artworks":[{"id":"d1","products":[]}]}"#)
    let app = AppState(api: APIClient(baseURL: base, transport: stub, token: "t"))
    await app.designs.load()
    app.designsPath = [.detail("d1"), .adjustArea]
    app.signOut()
    XCTAssertTrue(app.designs.artworks.isEmpty)
    XCTAssertTrue(app.designsPath.isEmpty)
  }

  // MARK: Adjust the area errors (T122: no marks any more, so the server's reason is shown)

  func testCleanupErrorShowsTheServersReason() {
    let empty = APIError.server(status: 422, code: "no_drawing_found", message: "Nothing was left in the cutout.")
    XCTAssertEqual(CleanupResult.errorMessage(for: empty),
                   "We couldn't find a drawing in that area. Make the frame bigger or move it over your drawing, then try again.",
                   "nothing in the frame: what to do about it")
    let other = APIError.server(status: 400, code: "invalid_request", message: "cleanup body does not match the contract")
    XCTAssertEqual(CleanupResult.errorMessage(for: other), "cleanup body does not match the contract")
    XCTAssertNil(CleanupResult.errorMessage(for: CancellationError()))
  }

  // MARK: T091 polish

  func testContinueAsksOnlyForASecondProductOrACreationInProgress() {
    let plain = artwork(products: [product("p-d", .sticker, "draft")])
    XCTAssertNil(ContinueRequest.make(artwork: plain, productType: .sticker, creationInProgress: false), "goes straight on")
    let replace = ContinueRequest.make(artwork: plain, productType: .sticker, creationInProgress: true)
    XCTAssertEqual(replace?.another, false)
    XCTAssertEqual(replace?.replacesCreation, true)
    XCTAssertEqual(replace?.confirmLabel, "Replace it")

    let shopOnly = artwork(products: [product("p-s", .sticker, "published")])
    let second = ContinueRequest.make(artwork: shopOnly, productType: .sticker, creationInProgress: false)
    XCTAssertEqual(second?.reusesDraft, false)
    XCTAssertEqual(second?.confirmLabel, "Make another sticker")
    XCTAssertEqual(second?.message, "A second product gets its own listing. To change the one in the shop, use Edit listing.")

    let shopAndDraft = artwork(products: [product("p-d", .sticker, "draft"), product("p-s", .sticker, "published")])
    let draft = ContinueRequest.make(artwork: shopAndDraft, productType: .sticker, creationInProgress: false)
    XCTAssertEqual(draft?.reusesDraft, true, "the draft is continued, so the text must say so")
    XCTAssertEqual(draft?.confirmLabel, "Yes, continue the draft")
    XCTAssertEqual(draft?.message, "This continues your sticker draft; no new product is made. To change the one in the shop, use Edit listing.")
    XCTAssertNil(ContinueRequest.make(artwork: shopAndDraft, productType: .tote, creationInProgress: false), "no tote yet")
    XCTAssertNil(ContinueRequest.make(artwork: shopAndDraft, productType: .sticker, creationInProgress: false, editingDraft: true),
                 "Edit listing on the draft row goes straight on, sticker in the shop or not (T091 review minor 1)")
    let editInProgress = ContinueRequest.make(artwork: shopAndDraft, productType: .sticker, creationInProgress: true, editingDraft: true)
    XCTAssertEqual(editInProgress?.another, false, "only the creation in progress is asked about")
    XCTAssertEqual(editInProgress?.confirmLabel, "Replace it")
  }

  func testCreationInProgressAndRequestContinue() {
    let app = AppState(api: APIClient(baseURL: base, transport: StubTransport(body: "{}"), token: "t"))
    XCTAssertFalse(app.hasCreationInProgress, "the product picker alone is not a creation")
    app.createPath = [.chooseMethod, .camera(.library)]
    XCTAssertTrue(app.hasCreationInProgress)
    let old = app.flow
    let design = artwork()
    let pending = app.requestContinue(artwork: design, productType: .sticker)
    XCTAssertEqual(pending?.replacesCreation, true)
    XCTAssertTrue(app.flow === old, "nothing is replaced before the confirmation")
    XCTAssertEqual(app.createPath, [.chooseMethod, .camera(.library)])

    app.createPath = [.listingDetails, .youreLive]
    XCTAssertFalse(app.hasCreationInProgress, "a design already live is done")
    XCTAssertNil(app.requestContinue(artwork: design, productType: .sticker))
    XCTAssertEqual(app.createPath, [.listingDetails], "went straight on")
  }

  func testEmptiedDescriptionIsSentAsEmpty() throws {
    XCTAssertEqual(EditListingSheet.descriptionEdit("  A bird. ", saved: "Old"), "A bird.")
    XCTAssertEqual(EditListingSheet.descriptionEdit("  ", saved: "Old"), "", "clearing a saved description sends \"\"")
    XCTAssertNil(EditListingSheet.descriptionEdit("", saved: nil), "nothing known to clear: omitted, the server keeps it")
    XCTAssertNil(EditListingSheet.descriptionEdit("", saved: ""))
    let json = try JSONEncoder().encode(ListingEdits(title: "T", description: "", priceCents: 500))
    let object = try XCTUnwrap(JSONSerialization.jsonObject(with: json) as? [String: Any])
    XCTAssertEqual(object["description"] as? String, "", "sent explicitly, not left out")
  }

  func testApproveRefusalsUseTheAppsWords() {
    let print = APIError.server(status: 409, code: "print_check_failed", message: "effective dpi 96 < 150")
    let words = APIError.server(status: 409, code: "moderation_failed", message: "flagged: harassment")
    XCTAssertTrue(APIError.approveMessage(for: print).hasPrefix("This picture won't print well yet."))
    XCTAssertTrue(APIError.approveMessage(for: words).hasPrefix("Some words in the name or description"))
    let other = APIError.server(status: 409, code: "listing_missing", message: "Write the listing first.")
    XCTAssertEqual(APIError.approveMessage(for: other), "Write the listing first.")
  }
}
