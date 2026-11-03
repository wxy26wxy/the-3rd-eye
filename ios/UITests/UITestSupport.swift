import XCTest

/// Shared steps for the UI tests that run against scripts/mock_api.py.
extension XCTestCase {
  /// Mock server root, from `TEST_RUNNER_MOCK_API_URL` (default http://localhost:3999).
  var mockAPIURL: URL {
    URL(string: ProcessInfo.processInfo.environment["MOCK_API_URL"] ?? "http://localhost:3999")!
  }

  /// Signs out if a previous test left the app signed in, then signs in with `code`.
  func signIn(_ app: XCUIApplication, code: String) {
    let start = app.buttons["Start creating"]
    if !start.waitForExistence(timeout: 5) { signOut(app) }
    start.tap()
    let field = app.textFields["Sign-in code"]
    XCTAssertTrue(field.waitForExistence(timeout: 5))
    field.tap()
    field.typeText(code)
    app.buttons["Sign in"].tap()
  }

  /// Signs out from the My designs tab (leaves a later test, such as the deep link one, signed out).
  func signOut(_ app: XCUIApplication) {
    openSignOutDialog(app)
    let confirm = signOutConfirm(app)
    XCTAssertTrue(confirm.waitForExistence(timeout: 5))
    confirm.tap()
    XCTAssertTrue(app.buttons["Start creating"].waitForExistence(timeout: 5))
  }

  /// Taps the header's sign-out button (identifier `sign-out`) on My designs.
  func openSignOutDialog(_ app: XCUIApplication) {
    app.tabBars.buttons["My designs"].tap()
    let button = app.buttons.matching(identifier: "sign-out").firstMatch
    XCTAssertTrue(button.waitForExistence(timeout: 5))
    button.tap()
  }

  /// The dialog's confirm: by its identifier, or, where the system dialog drops identifiers, the
  /// button labelled "Sign out" that is not the header button. Never by position.
  func signOutConfirm(_ app: XCUIApplication) -> XCUIElement {
    let byID = app.buttons.matching(identifier: "sign-out-confirm").firstMatch
    if byID.waitForExistence(timeout: 3) { return byID }
    return app.buttons.matching(NSPredicate(format: "label == %@ AND identifier != %@", "Sign out", "sign-out")).firstMatch
  }

  /// Waits until `element` is enabled (Change it's buttons wait while the product is made).
  func waitUntilEnabled(_ element: XCUIElement, timeout: TimeInterval = 20) {
    let enabled = expectation(for: NSPredicate(format: "exists == true AND isEnabled == true"), evaluatedWith: element)
    wait(for: [enabled], timeout: timeout)
  }

  /// Change it's product photo (round 4 ruling 2), once it is made.
  func productPhoto(_ app: XCUIApplication) -> XCUIElement {
    app.descendants(matching: .any)["change-product-photo"]
  }

  /// The last body the app sent to a mock route (`GET /__mock/last/<route>`); empty when none.
  func lastBody(_ route: String) throws -> [String: Any] {
    let url = mockAPIURL.appendingPathComponent("__mock/last/\(route)")
    let done = expectation(description: "mock \(route)")
    let received = Received()
    URLSession.shared.dataTask(with: url) { data, _, _ in
      received.data = data
      done.fulfill()
    }.resume()
    wait(for: [done], timeout: 10)
    return try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(received.data)) as? [String: Any])
  }

  /// Calls the app made to a mock route since sign-in (`GET /__mock/count/<route>`).
  func count(_ route: String) throws -> Int {
    let url = mockAPIURL.appendingPathComponent("__mock/count/\(route)")
    let done = expectation(description: "mock count \(route)")
    let received = Received()
    URLSession.shared.dataTask(with: url) { data, _, _ in
      received.data = data
      done.fulfill()
    }.resume()
    wait(for: [done], timeout: 10)
    let json = try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(received.data)) as? [String: Any])
    return try XCTUnwrap(json["count"] as? Int)
  }
}

/// Written once by the URLSession callback, read after the expectation is fulfilled.
private final class Received: @unchecked Sendable {
  var data: Data?
}
