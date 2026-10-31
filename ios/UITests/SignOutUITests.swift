import XCTest

/// The sign-out confirmation against scripts/mock_api.py: it keeps the version, git sha and
/// server (testers read them back), and its confirm is found by identifier, not position.
final class SignOutUITests: XCTestCase {
  override func setUp() { continueAfterFailure = false }

  func testSignOutDialogShowsVersionShaAndServer() {
    let app = XCUIApplication()
    app.launch()
    signIn(app, code: "TEST-CODE")
    XCTAssertTrue(app.tabBars.buttons["My designs"].waitForExistence(timeout: 10))
    openSignOutDialog(app)

    // "Signed in as <name>. Version <version> (<sha>), <server>"
    let pattern = ".*Signed in as .+\\. Version [^ ]+ \\([^)]+\\), \(mockAPIURL.absoluteString).*"
    let details = app.descendants(matching: .any).matching(NSPredicate(format: "label MATCHES %@", pattern)).firstMatch
    XCTAssertTrue(details.waitForExistence(timeout: 5), "version, git sha and server are in the dialog")

    let confirm = signOutConfirm(app)
    XCTAssertTrue(confirm.exists)
    XCTAssertNotEqual(confirm.identifier, "sign-out", "the confirm, not the header button")
    confirm.tap()
    XCTAssertTrue(app.buttons["Start creating"].waitForExistence(timeout: 5), "signed out")
  }
}
