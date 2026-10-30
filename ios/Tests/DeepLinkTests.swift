import XCTest
@testable import The3rdEye

final class DeepLinkTests: XCTestCase {
  func testCodeLinkParsesAndCleans() {
    XCTAssertEqual(DeepLink.parse(URL(string: "the3rdeye://code/ab-cd12")!), .code("AB-CD12"))
    XCTAssertEqual(DeepLink.parse(URL(string: "THE3RDEYE://CODE/WTA7YC")!), .code("WTA7YC"))
  }

  func testOtherLinksAreIgnored() {
    XCTAssertNil(DeepLink.parse(URL(string: "the3rdeye://order/123")!))
    XCTAssertNil(DeepLink.parse(URL(string: "https://example.com/code/ABC")!))
    XCTAssertNil(DeepLink.parse(URL(string: "the3rdeye://code/")!))
    XCTAssertNil(DeepLink.parse(URL(string: "the3rdeye://code/" + String(repeating: "A", count: 65))!))
  }

  @MainActor private func app(token: String?) -> AppState {
    AppState(api: APIClient(baseURL: URL(string: "http://localhost:3000/api/v1")!, transport: StubTransport(status: 200, body: "{}"), token: token))
  }

  @MainActor
  func testPendingCodeWhileSignedOutAndClearedOnSignOut() {
    let state = app(token: nil)
    state.open(URL(string: "the3rdeye://code/ABC123")!)
    XCTAssertEqual(state.pendingCode, "ABC123")
    state.signOut()
    XCTAssertNil(state.pendingCode)
  }

  @MainActor
  func testLinkIgnoredWhileSignedIn() {
    let state = app(token: "t0k")
    XCTAssertTrue(state.isSignedIn)
    state.open(URL(string: "the3rdeye://code/ABC123")!)
    XCTAssertNil(state.pendingCode)
  }
}

/// The rename (T085): the app's name, bundle id and URL scheme come from one place each.
final class BrandIdentityTests: XCTestCase {
  func testDisplayNameMatchesBrandToken() {
    XCTAssertEqual(Tokens.Brand.name, "The 3rd Eye")
    XCTAssertEqual(Tokens.Brand.wordmark, "THE 3RD EYE")
    XCTAssertEqual(Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String, Tokens.Brand.name)
  }

  func testBundleIdentifier() {
    XCTAssertEqual(Bundle.main.bundleIdentifier, "com.the3rdeye.app")
  }

  func testRegisteredSchemeIsTheOneDeepLinkParses() throws {
    let types = try XCTUnwrap(Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]])
    let schemes = types.flatMap { $0["CFBundleURLSchemes"] as? [String] ?? [] }
    XCTAssertEqual(schemes, [DeepLink.scheme])
    XCTAssertEqual(DeepLink.scheme, "the3rdeye")
  }

  func testDeployedSiteComesFromTheBuildSetting() {
    XCTAssertEqual(AppConfig.deployedSiteURL.scheme, "https")
    XCTAssertNotNil(AppConfig.deployedSiteURL.host)
  }
}
