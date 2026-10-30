import XCTest

/// Drives the voice branch against ios/scripts/mock_api.py and checks that Voice result
/// shows the image description as text ("WHAT THE IMAGE SHOWS"); there is no in-app speech.
/// Run: python3 scripts/mock_api.py & then
/// xcodebuild test -scheme MakerStoryUITests -destination '...' API_BASE_URL=http://localhost:3999
final class VoiceFlowUITests: XCTestCase {
  override func setUp() {
    continueAfterFailure = false
  }

  func testDescriptionIsShownAfterDrawing() {
    let app = XCUIApplication()
    app.launch()

    let start = app.buttons["Start creating"]
    if start.waitForExistence(timeout: 5) {
      start.tap()
      let code = app.textFields["Sign-in code"]
      XCTAssertTrue(code.waitForExistence(timeout: 5))
      code.tap()
      code.typeText("TEST-CODE")  // placeholder; the mock accepts any code
      app.buttons["Sign in"].tap()
    }

    let sticker = app.buttons["Sticker, Die-cut around your art"]
    XCTAssertTrue(sticker.waitForExistence(timeout: 10))
    sticker.tap()

    let voice = app.buttons["Say it out loud, Describe it, we draw it"]
    XCTAssertTrue(voice.waitForExistence(timeout: 5))
    voice.tap()

    let typeInstead = app.buttons["Type instead"]
    XCTAssertTrue(typeInstead.waitForExistence(timeout: 5))
    typeInstead.tap()
    let idea = app.textFields["Your idea"].exists ? app.textFields["Your idea"] : app.textViews["Your idea"]
    XCTAssertTrue(idea.waitForExistence(timeout: 5))
    idea.tap()
    idea.typeText("a frog with a crown")
    app.buttons["Done"].tap()

    // Loading screen shows the spoken confirmation as text.
    XCTAssertTrue(app.staticTexts["A happy frog with a gold crown. Drawing it now."].waitForExistence(timeout: 10))

    // Voice result: the description card shows the spoken description as text.
    XCTAssertTrue(app.staticTexts["YOU SAID"].waitForExistence(timeout: 15))
    // The card is one VoiceOver element: heading and description read together.
    let card = app.descendants(matching: .any).matching(NSPredicate(
      format: "label CONTAINS %@ AND label CONTAINS %@", "WHAT THE IMAGE SHOWS", "A smiling green frog sits in the middle.")).firstMatch
    XCTAssertTrue(card.waitForExistence(timeout: 3), "description card shows the spoken description")
    XCTAssertFalse(app.buttons["Hear what the image shows"].exists)
    XCTAssertFalse(app.buttons["Stop"].exists)
    let shot = XCTAttachment(screenshot: app.screenshot())
    shot.name = "voice-result"
    shot.lifetime = .keepAlways
    add(shot)
  }
}
