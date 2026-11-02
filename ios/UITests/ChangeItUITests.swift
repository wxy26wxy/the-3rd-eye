import XCTest

/// Photo first, then "Change it" (T114) against scripts/mock_api.py: the app uses the generated
/// test photo (UITEST_PHOTO=1); the mock answers two drawings, `change` makes child rows ch1, ch2…
/// with a description, and `cutout` cuts a changed picture. Bodies are read back with
/// GET /__mock/last/<route>.
final class ChangeItUITests: XCTestCase {
  private var app: XCUIApplication?

  override func setUp() {
    continueAfterFailure = false
  }

  /// Leave the simulator signed out, as a fresh install is (DeepLinkUITests needs that).
  override func tearDown() {
    if let app, app.state == .runningForeground, !app.buttons["Start creating"].exists { signOut(app) }
    app = nil
    super.tearDown()
  }

  /// Type a change → Before and after (what you asked, before / after, what it shows) → Use this →
  /// Making your cutout → Your cutout → Making your sticker → Listing details for the changed art.
  func testTypedChangeGoesOnToTheListing() throws {
    let app = launchPhotoFlow(code: "TEST-CODE")
    pickPiece(app, "Piece 1")

    XCTAssertTrue(app.staticTexts["WHAT SHOULD I CHANGE?"].waitForExistence(timeout: 10), "Change it")
    typeChange(app, "Make the sky purple")
    tap(app, "Make the change")

    XCTAssertTrue(app.staticTexts["Here's the change"].waitForExistence(timeout: 20), "Before and after")
    XCTAssertTrue(element(app, containing: "YOU ASKED", and: "Make the sky purple").exists, "the request is one card")
    XCTAssertTrue(element(app, containing: "WHAT THE IMAGE SHOWS", and: "The sky above it is purple now.").exists,
                  "the description of the change is shown as text")
    XCTAssertTrue(element(app, containing: "Before", and: "Cut-out of cand-1").exists, "before = the picked drawing")
    XCTAssertTrue(element(app, containing: "After", and: "Yellow school bus under a purple sky").exists, "after = the change")
    XCTAssertTrue(app.buttons["Change it again"].exists)
    XCTAssertTrue(app.buttons["Back to my original"].exists)
    let change = try lastBody("change")
    XCTAssertEqual(change["artworkId"] as? String, "p1", "the picked drawing is changed")
    XCTAssertEqual(change["instruction"] as? String, "Make the sky purple")
    XCTAssertNil(change["transcript"], "a typed change sends no transcript")
    attachScreenshot(app, "before-and-after")

    tap(app, "Use this")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 15), "Your cutout")
    XCTAssertEqual(try lastBody("cutout")["artworkId"] as? String, "ch1", "the change is cut out")
    XCTAssertTrue(app.otherElements["cutout-applied"].exists || app.images["cutout-applied"].exists)

    tap(app, "Use this")
    let name = app.textFields["Name"]
    XCTAssertTrue(name.waitForExistence(timeout: 20), "Making your sticker, then Listing details")
    XCTAssertEqual(try lastBody("products")["artworkId"] as? String, "ch1")
    XCTAssertEqual(try lastBody("products")["type"] as? String, "sticker")
  }

  /// "Change it again" edits the change (ch1 → ch2); "Back to my original" drops the changes, and
  /// "Looks good as is" then uses the drawing's own cut-out with no further call.
  func testChangeAgainThenBackToTheOriginal() throws {
    let app = launchPhotoFlow(code: "TEST-CODE")
    pickPiece(app, "Piece 1")
    typeChange(app, "Make the sky purple")
    tap(app, "Make the change")
    XCTAssertTrue(app.buttons["Change it again"].waitForExistence(timeout: 20))
    app.buttons["Change it again"].tap()

    let field = changeField(app)
    XCTAssertTrue(field.waitForExistence(timeout: 5), "back on Change it")
    XCTAssertTrue(element(app, containing: "Your art", and: "Yellow school bus under a purple sky").exists, "Change it shows the change")
    XCTAssertNotEqual(field.value as? String, "Make the sky purple", "the field starts empty")
    typeChange(app, "Add a sun")
    tap(app, "Make the change")
    XCTAssertTrue(app.staticTexts["Here's the change"].waitForExistence(timeout: 20))
    XCTAssertEqual(try lastBody("change")["artworkId"] as? String, "ch1", "the second change edits the first")

    app.buttons["Back to my original"].tap()
    XCTAssertTrue(changeField(app).waitForExistence(timeout: 5))
    XCTAssertTrue(element(app, containing: "Your art", and: "Cut-out of cand-1").exists, "the original is back")
    tap(app, "Looks good as is")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 15))
    XCTAssertTrue(try lastBody("cutout").isEmpty, "the drawing's cut-out exists: no cutout call")
    tap(app, "Use this")
    XCTAssertTrue(app.textFields["Name"].waitForExistence(timeout: 20))
    XCTAssertEqual(try lastBody("products")["artworkId"] as? String, "p1", "the original drawing becomes the product")
  }

  /// One drawing, already cut out (mock ONE…): no Choose a pattern; Change it comes first, and a tote
  /// bag is made with the tote copy.
  func testSingleDrawingGoesStraightToChangeIt() throws {
    let app = launchPhotoFlow(code: "ONE-CODE", product: "Tote bag, Natural canvas")
    XCTAssertTrue(app.buttons["Looks good as is"].waitForExistence(timeout: 20), "Change it right after the photo")
    XCTAssertFalse(app.buttons["Piece 1"].exists)
    XCTAssertTrue(element(app, containing: "WHAT THE IMAGE SHOWS", and: "Cut-out of piece 1").exists)
    app.buttons["Looks good as is"].tap()
    tap(app, "Use this")
    XCTAssertTrue(app.textFields["Name"].waitForExistence(timeout: 20))
    XCTAssertEqual(try lastBody("products")["type"] as? String, "tote")
  }

  /// "Make the change" waits for words; the mic button is there with its label.
  func testMakeTheChangeNeedsWords() {
    let app = launchPhotoFlow(code: "ONE-CODE")
    let make = app.buttons["Make the change"]
    XCTAssertTrue(make.waitForExistence(timeout: 20))
    XCTAssertFalse(make.isEnabled, "dimmed until there is a change")
    XCTAssertTrue(app.buttons["Say what to change"].exists, "the record button reads its label")
    typeChange(app, "Make it blue")
    XCTAssertTrue(make.isEnabled)
    attachScreenshot(app, "change-it")
  }

  // MARK: Helpers

  private func launchPhotoFlow(code: String, product: String = "Sticker, Die-cut, waterproof") -> XCUIApplication {
    let app = XCUIApplication()
    self.app = app
    app.launchEnvironment["UITEST_PHOTO"] = "1"
    app.launchEnvironment["MOCK_BLOB_API"] = mockAPIURL.appendingPathComponent("blob").absoluteString + "/"
    app.launch()
    signIn(app, code: code)
    let card = app.buttons[product]
    XCTAssertTrue(card.waitForExistence(timeout: 10))
    card.tap()
    let upload = app.buttons["Upload a picture, Pick one you already have"]
    XCTAssertTrue(upload.waitForExistence(timeout: 5))
    upload.tap()
    return app
  }

  private func pickPiece(_ app: XCUIApplication, _ name: String) {
    let piece = app.buttons[name]
    XCTAssertTrue(piece.waitForExistence(timeout: 20), "Choose a pattern shows the drawings")
    piece.tap()
    tap(app, "Use this")
  }

  private func changeField(_ app: XCUIApplication) -> XCUIElement {
    app.textViews["What to change"].exists ? app.textViews["What to change"] : app.textFields["What to change"]
  }

  private func typeChange(_ app: XCUIApplication, _ text: String) {
    let field = changeField(app)
    XCTAssertTrue(field.waitForExistence(timeout: 10))
    field.tap()
    field.typeText(text)
    // Close the keyboard (its Done) so the pinned bar and the tab bar come back.
    let done = app.buttons["Done"]
    if done.waitForExistence(timeout: 2) { done.tap() }
    XCTAssertTrue(app.buttons["Looks good as is"].waitForExistence(timeout: 3), "the pinned bar is back")
  }

  private func tap(_ app: XCUIApplication, _ label: String) {
    let button = app.buttons[label]
    XCTAssertTrue(button.waitForExistence(timeout: 10), "\(label) is shown")
    for _ in 0..<3 where !button.isHittable { app.swipeUp() }
    XCTAssertTrue(button.isEnabled, "\(label) is enabled")
    button.tap()
  }

  private func element(_ app: XCUIApplication, containing a: String, and b: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@ AND label CONTAINS %@", a, b)).firstMatch
  }

  private func attachScreenshot(_ app: XCUIApplication, _ name: String) {
    let shot = XCTAttachment(screenshot: app.screenshot())
    shot.name = name
    shot.lifetime = .keepAlways
    add(shot)
  }
}
