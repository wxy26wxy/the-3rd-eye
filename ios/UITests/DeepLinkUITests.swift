import XCTest

/// Opening the3rdeye://code/<CODE> while signed out lands on the code screen with the
/// code filled in. The system "Open in The 3rd Eye?" prompt is accepted from Springboard.
/// Run with scripts/mock_api.py like VoiceFlowUITests (a signed-in state is reset by the mock's 401-free sign-in).
final class DeepLinkUITests: XCTestCase {
  override func setUp() { continueAfterFailure = false }

  func testCodeLinkPrefillsTheCodeScreen() throws {
    let app = XCUIApplication()
    app.launch()
    // Make sure we are signed out: a fresh install is; if the Welcome screen is not there, skip.
    guard app.buttons["Start creating"].waitForExistence(timeout: 5) else {
      throw XCTSkip("App is signed in on this simulator; deep-link prefill only applies while signed out.")
    }

    app.open(URL(string: "the3rdeye://code/testlink1")!)
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let open = springboard.buttons["Open"]
    if open.waitForExistence(timeout: 5) { open.tap() }

    let hint = app.staticTexts["We filled in your code from the link. Tap Sign in."]
    XCTAssertTrue(hint.waitForExistence(timeout: 5))
    let field = app.textFields["Sign-in code"]
    XCTAssertTrue(field.waitForExistence(timeout: 5))
    XCTAssertEqual(field.value as? String, "TESTLINK1")
  }
}
