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
    signIn(app, code: "TEST-CODE")  // placeholder; the mock accepts any code (simple mode on)

    let sticker = app.buttons["Sticker, Die-cut around your art"]
    XCTAssertTrue(sticker.waitForExistence(timeout: 10))
    sticker.tap()
    describeIdea(app)

    // Loading screen shows the spoken confirmation as text.
    XCTAssertTrue(app.staticTexts["A happy frog with a gold crown. Drawing it now."].waitForExistence(timeout: 10))

    // Voice result: the description card shows the spoken description as text.
    XCTAssertTrue(app.staticTexts["YOU SAID"].waitForExistence(timeout: 15))
    // The card is one VoiceOver element: heading and description read together.
    let card = app.descendants(matching: .any).matching(NSPredicate(
      format: "label CONTAINS %@ AND label CONTAINS %@", "WHAT THE IMAGE SHOWS", "A smiling green frog sits in the middle.")).firstMatch
    XCTAssertTrue(card.waitForExistence(timeout: 3), "description card shows the spoken description")
    XCTAssertTrue(app.images["Green frog with a gold crown"].exists, "the picture reads its alt text")
    XCTAssertFalse(app.buttons["Hear what the image shows"].exists)
    XCTAssertFalse(app.buttons["Stop"].exists)
    let shot = XCTAttachment(screenshot: app.screenshot())
    shot.name = "voice-result"
    shot.lifetime = .keepAlways
    add(shot)
  }

  /// Simple mode off (mock code MULTI…): three pictures in a pager; the visible one reads its own alt text.
  func testPagerPictureReadsItsAltText() {
    let app = XCUIApplication()
    app.launch()
    signIn(app, code: "MULTI-CODE")

    let sticker = app.buttons["Sticker, Die-cut around your art"]
    XCTAssertTrue(sticker.waitForExistence(timeout: 10))
    sticker.tap()
    app.buttons["Next"].tap()
    describeIdea(app)

    XCTAssertTrue(app.staticTexts["YOU SAID"].waitForExistence(timeout: 20))
    let first = app.images.matching(NSPredicate(format: "label BEGINSWITH %@", "Green frog with a gold crown, picture 1 of 3")).firstMatch
    XCTAssertTrue(first.waitForExistence(timeout: 3), "visible picture is labelled with its alt text; got \(app.images.allElementsBoundByIndex.map(\.label))")
    first.swipeLeft()
    let second = app.images.matching(NSPredicate(format: "label BEGINSWITH %@", "Green frog with a gold crown, version 2, picture 2 of 3")).firstMatch
    XCTAssertTrue(second.waitForExistence(timeout: 3), "after a swipe the next picture reads its own alt text; got \(app.images.allElementsBoundByIndex.map(\.label))")
  }

  // MARK: Helpers

  /// Signs out if a previous test left the app signed in, then signs in with `code`.
  private func signIn(_ app: XCUIApplication, code: String) {
    let start = app.buttons["Start creating"]
    if !start.waitForExistence(timeout: 5) {
      app.tabBars.buttons["My designs"].tap()
      let signOut = app.buttons["Sign out"].firstMatch
      XCTAssertTrue(signOut.waitForExistence(timeout: 5))
      signOut.tap()
      let confirm = app.sheets.buttons["Sign out"].exists ? app.sheets.buttons["Sign out"] : app.buttons.matching(identifier: "Sign out").element(boundBy: 1)
      XCTAssertTrue(confirm.waitForExistence(timeout: 5))
      confirm.tap()
      XCTAssertTrue(start.waitForExistence(timeout: 5))
    }
    start.tap()
    let field = app.textFields["Sign-in code"]
    XCTAssertTrue(field.waitForExistence(timeout: 5))
    field.tap()
    field.typeText(code)
    app.buttons["Sign in"].tap()
  }

  private func describeIdea(_ app: XCUIApplication) {
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
  }
}
