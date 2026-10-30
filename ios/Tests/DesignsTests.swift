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
      "products":[{"id":"p1","type":"sticker","status":"published","title":"Bird"},{"id":"p2","type":"tote","status":"draft","title":null}]}]}
    """
    let res = try JSONDecoder().decode(ArtworksResponse.self, from: Data(json.utf8))
    let item = try XCTUnwrap(res.artworks.first)
    XCTAssertEqual(item.lastError, "boom")
    XCTAssertEqual(item.products?.map(\.id), ["p1", "p2"])
    XCTAssertTrue(item.products?[0].isPublished == true)
    XCTAssertTrue(item.products?[0].hasListing == true)
    XCTAssertFalse(item.products?[1].hasListing == true)
    XCTAssertEqual(DesignBadge.of(item), .inShop)
  }

  // MARK: Continue to listing

  func testContinueFromSetsFlowAndRoute() {
    let app = AppState(api: APIClient(baseURL: base, transport: StubTransport(body: "{}"), token: "t"))
    app.selectedTab = .designs
    app.createPath = [.chooseMethod, .speak]
    let old = app.flow
    let design = artwork(products: [product("p-tote", .tote, "published")])

    app.continueFrom(artwork: design, productType: .sticker)

    XCTAssertEqual(app.selectedTab, .create)
    XCTAssertEqual(app.createPath, [.listingDetails])
    XCTAssertFalse(app.flow === old, "a new creation")
    XCTAssertEqual(app.flow.artwork?.id, "d1")
    XCTAssertEqual(app.flow.productType, .sticker)
    XCTAssertNil(app.flow.product, "no sticker draft to reuse: Listing details makes one")
  }

  func testContinueFromReusesDraftOfThatType() {
    let app = AppState(api: APIClient(baseURL: base, transport: StubTransport(body: "{}"), token: "t"))
    let design = artwork(products: [product("p-sticker", .sticker, "published"), product("p-tote", .tote, "draft", title: "Bird Tote")])

    app.continueFrom(artwork: design, productType: .tote)
    XCTAssertEqual(app.flow.product?.id, "p-tote")
    XCTAssertEqual(app.flow.product?.type, .tote)
    XCTAssertEqual(app.flow.productTitle, "Bird Tote")

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
      (404, #"{"error":{"code":"not_found","message":"Not found"}}"#),
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
    app.designsPath = [.detail("d1"), .redoCutout]
    app.signOut()
    XCTAssertTrue(app.designs.artworks.isEmpty)
    XCTAssertTrue(app.designsPath.isEmpty)
  }

  // MARK: Adjust cutout errors (T082 parked R1)

  func testRemoveAdviceOnlyAfterRemoveMarks() {
    let error = APIError.server(status: 422, code: "no_drawing_found", message: "Nothing was left in the cutout.")
    let withNegative = CleanupRequest(candidateIds: ["c1", "c2"], points: [CutoutPoint(x: 1, y: 1, label: .negative)])
    let withoutNegative = CleanupRequest(candidateIds: ["c1", "c2"], points: [CutoutPoint(x: 1, y: 1, label: .positive)])
    XCTAssertEqual(CleanupResult.errorMessage(for: error, request: withNegative), CleanupResult.removeAdvice)
    XCTAssertEqual(CleanupResult.errorMessage(for: error, request: withoutNegative), "Nothing was left in the cutout.")
    XCTAssertEqual(CleanupResult.errorMessage(for: error, request: CleanupRequest(candidateIds: ["c1"])), "Nothing was left in the cutout.")
    XCTAssertNil(CleanupResult.errorMessage(for: CancellationError(), request: withNegative))
  }
}
