import XCTest
@testable import MakerStory

final class DeepLinkTests: XCTestCase {
  func testCodeLinkParsesAndCleans() {
    XCTAssertEqual(DeepLink.parse(URL(string: "makerstory://code/ab-cd12")!), .code("AB-CD12"))
    XCTAssertEqual(DeepLink.parse(URL(string: "MAKERSTORY://CODE/WTA7YC")!), .code("WTA7YC"))
  }

  func testOtherLinksAreIgnored() {
    XCTAssertNil(DeepLink.parse(URL(string: "makerstory://order/123")!))
    XCTAssertNil(DeepLink.parse(URL(string: "https://example.com/code/ABC")!))
    XCTAssertNil(DeepLink.parse(URL(string: "makerstory://code/")!))
    XCTAssertNil(DeepLink.parse(URL(string: "makerstory://code/" + String(repeating: "A", count: 65))!))
  }

  @MainActor
  func testPendingCodeOnlyWhileSignedOut() {
    let app = AppState(api: APIClient(baseURL: URL(string: "http://localhost:3000/api/v1")!, transport: StubTransport(status: 200, body: "{}"), token: nil))
    app.open(URL(string: "makerstory://code/ABC123")!)
    XCTAssertEqual(app.pendingCode, "ABC123")
  }
}
