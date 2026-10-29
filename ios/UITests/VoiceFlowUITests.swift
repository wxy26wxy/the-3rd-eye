import XCTest

/// Drives the voice branch against ios/scripts/mock_api.py and checks that the
/// description is being spoken when Voice result appears after the loading screen.
/// Run: python3 scripts/mock_api.py & then
/// xcodebuild test -scheme MakerStoryUITests -destination '...' API_BASE_URL=http://localhost:3999
final class VoiceFlowUITests: XCTestCase {
  override func setUp() {
    continueAfterFailure = false
  }

  func testDescriptionIsSpokenAfterDrawing() {
    let app = XCUIApplication()
    app.launch()

    let start = app.buttons["Start creating"]
    if start.waitForExistence(timeout: 5) {
      start.tap()
      let code = app.textFields["Sign-in code"]
      XCTAssertTrue(code.waitForExistence(timeout: 5))
      code.tap()
      code.typeText("TEST")
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

    // Voice result: the hear button reads "Stop" while the description is playing,
    // i.e. leaving the loading screen did not cancel the arrival speech.
    XCTAssertTrue(app.staticTexts["YOU SAID"].waitForExistence(timeout: 15))
    XCTAssertTrue(app.buttons["Stop"].waitForExistence(timeout: 3), "description should be speaking on arrival")
    let shot = XCTAttachment(screenshot: app.screenshot())
    shot.name = "voice-result"
    shot.lifetime = .keepAlways
    add(shot)

    // Stopping mid-sentence must not freeze the app (regression: stopSpeaking deadlock).
    app.buttons["Stop"].tap()
    XCTAssertTrue(app.buttons["Hear what the image shows"].waitForExistence(timeout: 3))
  }
}
