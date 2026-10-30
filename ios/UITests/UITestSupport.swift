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
    app.tabBars.buttons["My designs"].tap()
    let signOut = app.buttons["Sign out"].firstMatch
    XCTAssertTrue(signOut.waitForExistence(timeout: 5))
    signOut.tap()
    let confirm = app.sheets.buttons["Sign out"].exists ? app.sheets.buttons["Sign out"] : app.buttons.matching(identifier: "Sign out").element(boundBy: 1)
    XCTAssertTrue(confirm.waitForExistence(timeout: 5))
    confirm.tap()
    XCTAssertTrue(app.buttons["Start creating"].waitForExistence(timeout: 5))
  }
}
