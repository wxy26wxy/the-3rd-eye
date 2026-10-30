import XCTest
@testable import The3rdEye

final class ShareAndHelpersTests: XCTestCase {
  func testDefaultSplitIsHalf() {
    XCTAssertEqual(Money.creatorShareCents(priceCents: 500, split: .default), 250)
    XCTAssertEqual(Money.creatorShareCents(priceCents: 1200, split: .default), 600)
  }

  func testShareRoundsDownToWholeCents() {
    XCTAssertEqual(Money.creatorShareCents(priceCents: 999, split: .default), 499)
    XCTAssertEqual(Money.creatorShareCents(priceCents: 101, split: Split(creatorBps: 7000, orgBps: 1000, productionBps: 2000)), 70)
  }

  func testShareEdgeCases() {
    XCTAssertEqual(Money.creatorShareCents(priceCents: 0, split: .default), 0)
    XCTAssertEqual(Money.creatorShareCents(priceCents: -5, split: .default), 0)
    XCTAssertEqual(Money.creatorShareCents(priceCents: 500, split: Split(creatorBps: 10_000, orgBps: 0, productionBps: 0)), 500)
  }

  func testPriceParsing() {
    XCTAssertEqual(Money.cents(from: "5"), 500)
    XCTAssertEqual(Money.cents(from: "$5.50"), 550)
    XCTAssertEqual(Money.cents(from: "5,25"), 525)
    XCTAssertNil(Money.cents(from: "five"))
  }

  func testBlobStoreIdFromClientToken() {
    XCTAssertEqual(BlobUploader.storeId(fromClientToken: "vercel_blob_client_store123_payload"), "store123")
    XCTAssertEqual(BlobUploader.storeId(fromClientToken: "bad"), "")
  }

  func testBlobPathname() {
    let path = BlobUploader.pathname(creatorId: "c1", kind: .storyVideo, fileExtension: "mov")
    XCTAssertTrue(path.hasPrefix("creators/c1/story-video/"))
    XCTAssertTrue(path.hasSuffix(".mov"))
  }

  func testBlobUploadProtocol() async throws {
    let api = APIClient(baseURL: URL(string: "http://localhost:3000/api/v1")!, transport: StubTransport(body: #"{"clientToken":"vercel_blob_client_store9_xyz"}"#), token: "t")
    let blob = StubTransport(body: #"{"url":"https://store9.public.blob.vercel-storage.com/creators/c1/photos/a.jpg","downloadUrl":null,"pathname":"creators/c1/photos/a.jpg","contentType":"image/jpeg"}"#)
    let uploader = BlobUploader(api: api, transport: blob)
    let result = try await uploader.upload(Data([1, 2, 3]), creatorId: "c1", kind: .photo, contentType: "image/jpeg", fileExtension: "jpg")
    XCTAssertEqual(result.pathname, "creators/c1/photos/a.jpg")
    let put = try XCTUnwrap(blob.requests.first)
    XCTAssertEqual(put.httpMethod, "PUT")
    XCTAssertEqual(put.url?.host, "vercel.com")
    XCTAssertEqual(put.value(forHTTPHeaderField: "authorization"), "Bearer vercel_blob_client_store9_xyz")
    XCTAssertEqual(put.value(forHTTPHeaderField: "x-vercel-blob-store-id"), "store9")
    XCTAssertEqual(put.value(forHTTPHeaderField: "x-api-version"), BlobUploader.apiVersion)
    XCTAssertEqual(put.value(forHTTPHeaderField: "x-content-type"), "image/jpeg")
  }

  func testOrdersMergeKeepsNewestFirst() async {
    await MainActor.run {
      let store = OrdersStore(api: APIClient(baseURL: URL(string: "http://localhost")!, transport: StubTransport(body: "{}"), token: nil))
      store.merge([OrderSummary(id: "a", createdAt: "2026-10-28T10:00:00Z")], replacing: true)
      store.merge([OrderSummary(id: "b", createdAt: "2026-10-28T11:00:00Z")], replacing: false)
      XCTAssertEqual(store.orders.map(\.id), ["b", "a"])
    }
  }
}
