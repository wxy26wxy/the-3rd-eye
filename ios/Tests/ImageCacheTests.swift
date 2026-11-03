import XCTest
@testable import The3rdEye

/// Ruling 3 (T144): the memory cache behind `RemoteImage`, its keys, tile downsampling, and the
/// quiet My designs refresh.
@MainActor
final class ImageCacheTests: XCTestCase {
  /// Answers every request with the same picture and counts them.
  private final class PictureTransport: HTTPTransport, @unchecked Sendable {
    let data: Data
    private(set) var requests: [URLRequest] = []
    init(data: Data) { self.data = data }
    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
      requests.append(request)
      return (data, HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
    }
  }

  private func png(width: Int, height: Int) -> Data {
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height), format: format)
    return renderer.pngData { context in
      UIColor.systemTeal.setFill()
      context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    }
  }

  func testSecondLoadIsACacheHitWithoutARequest() async throws {
    let transport = PictureTransport(data: png(width: 40, height: 30))
    let loader = ImageLoader(cache: ImageCache(), transport: transport)
    let url = URL(string: "https://blob.example/creators/c1/mockups/a.png")!
    XCTAssertNil(loader.cachedImage(for: url), "nothing in memory before the first load")
    _ = try await loader.image(for: url)
    XCTAssertEqual(transport.requests.count, 1)
    XCTAssertEqual(transport.requests.first?.cachePolicy, .returnCacheDataElseLoad, "the disk cache answers first")
    let again = try await loader.image(for: url)
    XCTAssertEqual(transport.requests.count, 1, "a cached picture needs no request")
    XCTAssertEqual(again.size, CGSize(width: 40, height: 30))
    XCTAssertNotNil(loader.cachedImage(for: url), "and is there synchronously for the next view")
  }

  func testPresignedLinksShareOneKeyWithoutTheirQuery() {
    let first = URL(string: "https://store.private.blob.example/creators/c1/photos/a.jpg?vercel-blob-signature=abc&validUntil=1")!
    let second = URL(string: "https://store.private.blob.example/creators/c1/photos/a.jpg?vercel-blob-signature=def&validUntil=2")!
    XCTAssertTrue(ImageCache.isPresigned(first))
    XCTAssertEqual(ImageCache.key(for: first), "https://store.private.blob.example/creators/c1/photos/a.jpg")
    XCTAssertEqual(ImageCache.key(for: first), ImageCache.key(for: second), "a new signature is the same file")
    let amz = URL(string: "https://s3.example/b/a.png?X-Amz-Signature=1&X-Amz-Expires=600")!
    XCTAssertEqual(ImageCache.key(for: amz), "https://s3.example/b/a.png")
  }

  func testPublicLinksKeepTheirQuery() {
    let one = URL(string: "http://localhost:3999/sticker-preview.png?p=pr-1")!
    let two = URL(string: "http://localhost:3999/sticker-preview.png?p=pr-2")!
    XCTAssertFalse(ImageCache.isPresigned(one))
    XCTAssertEqual(ImageCache.key(for: one), one.absoluteString)
    XCTAssertNotEqual(ImageCache.key(for: one), ImageCache.key(for: two), "two products, two pictures")
    XCTAssertNotEqual(ImageCache.key(for: one, maxPixel: 600), ImageCache.key(for: one), "a tile copy has its own key")
  }

  func testTilesAreDownsampledAndCachedUnderTheirOwnKey() async throws {
    let transport = PictureTransport(data: png(width: 1200, height: 800))
    let cache = ImageCache()
    let loader = ImageLoader(cache: cache, transport: transport)
    let url = URL(string: "https://blob.example/m.png")!
    let tile = try await loader.image(for: url, maxPixel: ImageLoader.tilePixels)
    XCTAssertEqual(max(tile.size.width * tile.scale, tile.size.height * tile.scale), 600, accuracy: 1)
    XCTAssertEqual(tile.size.width / tile.size.height, 1.5, accuracy: 0.01, "keeps the aspect")
    XCTAssertNil(loader.cachedImage(for: url), "the full picture is not the tile")
    let full = try await loader.image(for: url)
    XCTAssertEqual(full.size.width * full.scale, 1200)
    XCTAssertEqual(transport.requests.count, 2)
    XCTAssertNotNil(cache.image(forKey: ImageCache.key(for: url, maxPixel: 600)))
  }

  func testDownsampleNeverEnlarges() throws {
    let small = try XCTUnwrap(ImageLoader.downsample(png(width: 100, height: 50), maxPixel: 600))
    XCTAssertEqual(small.size.width, 100)
  }

  func testCostIsDecodedBytes() {
    let image = UIImage(data: png(width: 10, height: 10))!
    XCTAssertGreaterThanOrEqual(ImageCache.cost(of: image), 400)
    XCTAssertEqual(ImageCache.defaultCostLimit, 50 * 1024 * 1024)
  }

  // MARK: Quiet list refresh

  private let listJSON = """
  {"artworks":[{"id":"d1","cleanedUrl":"https://blob.example/c.png","status":"ready","products":[]},
               {"id":"d2","cleanedUrl":"https://blob.example/d.png","status":"ready","products":[]}]}
  """

  func testLoadWithinThirtySecondsMakesNoRequest() async {
    let transport = StubTransport(body: listJSON)
    let store = DesignsStore(api: APIClient(baseURL: URL(string: "http://localhost:3000/api/v1")!, transport: transport, token: "t"))
    var clock = Date(timeIntervalSince1970: 1_000)
    store.now = { clock }
    await store.load()
    XCTAssertEqual(transport.requests.count, 1)
    clock += 20
    await store.load()
    XCTAssertEqual(transport.requests.count, 1, "fetched 20 s ago: the list stays")
    await store.load(force: true)
    XCTAssertEqual(transport.requests.count, 2, "pull to refresh fetches")
    clock += 31
    await store.load()
    XCTAssertEqual(transport.requests.count, 3, "after 30 s it fetches again")
    store.markStale()
    await store.load()
    XCTAssertEqual(transport.requests.count, 4, "a creation step or a delete makes the list stale")
  }

  func testOnlyChangedRowsAreReplaced() {
    let d1 = Artwork(id: "d1", cleanedUrl: "a")
    let d2 = Artwork(id: "d2", cleanedUrl: "b")
    var d2New = d2
    d2New.cleanedUrl = "c"
    let d3 = Artwork(id: "d3")
    let merged = DesignsStore.merged(old: [d1, d2], new: [d3, d1, d2New])
    XCTAssertEqual(merged, [d3, d1, d2New])
    XCTAssertEqual(DesignsStore.merged(old: [d1, d2], new: [d1, d2]), [d1, d2])
  }

  func testCreationStepsMakeTheListStale() async {
    let transport = StubTransport(body: listJSON)
    let app = AppState(api: APIClient(baseURL: URL(string: "http://localhost:3000/api/v1")!, transport: transport, token: "t"))
    await app.designs.load()
    XCTAssertNotNil(app.designs.fetchedAt)
    app.push(.chooseMethod)
    XCTAssertNil(app.designs.fetchedAt)
  }
}
