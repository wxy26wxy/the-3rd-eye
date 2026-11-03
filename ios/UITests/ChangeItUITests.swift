import XCTest

/// Photo first, then "Change it" (T114) against scripts/mock_api.py: the app uses the generated
/// test photo (UITEST_PHOTO=1); the mock finds two drawings inside the frame (`detect`), `change` makes child rows ch1, ch2…
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
    cutPiece(app)

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
    XCTAssertEqual(try count("cutout"), 1)

    // Back to Before and after and Use this again: the cut-out is cached per artwork (T131).
    app.buttons["Back"].firstMatch.tap()
    XCTAssertTrue(app.staticTexts["Here's the change"].waitForExistence(timeout: 5), "Back from Your cutout: Before and after")
    tap(app, "Use this")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 10))
    XCTAssertEqual(try count("cutout"), 1, "no second cutout for the same change")

    tap(app, "Use this")
    let name = app.textFields["Name"]
    XCTAssertTrue(name.waitForExistence(timeout: 20), "Making your sticker, then Listing details")
    XCTAssertEqual(try lastBody("products")["artworkId"] as? String, "ch1")
    XCTAssertEqual(try lastBody("products")["type"] as? String, "sticker")
  }

  /// "Change it again" edits the change (ch1 → ch2); "Back to my original" steps back one change
  /// (T131: to ch1, the chain kept), and again to the drawing; "Looks good as is" then makes the
  /// sticker from the drawing's own cut-out (no cutout call).
  func testChangeAgainThenBackOneStepAtATime() throws {
    let app = launchPhotoFlow(code: "TEST-CODE")
    cutPiece(app)
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
    XCTAssertTrue(element(app, containing: "Your art", and: "Yellow school bus under a purple sky").exists, "one change back: the first change")
    typeChange(app, "Add a moon")
    tap(app, "Make the change")
    XCTAssertTrue(app.staticTexts["Here's the change"].waitForExistence(timeout: 20))
    XCTAssertEqual(try lastBody("change")["artworkId"] as? String, "ch1", "the chain kept ch1")
    XCTAssertTrue(element(app, containing: "YOU ASKED", and: "Add a moon").exists)
    app.buttons["Back to my original"].tap()
    XCTAssertTrue(changeField(app).waitForExistence(timeout: 5))
    XCTAssertTrue(element(app, containing: "Your art", and: "Yellow school bus").exists, "ch3 → ch1")
    // Looks good on ch1 (never cut out): Making your cutout, Your cutout, then the product.
    tap(app, "Looks good as is")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 15), "the change is cut out first")
    XCTAssertEqual(try lastBody("cutout")["artworkId"] as? String, "ch1")
    app.buttons["Back"].firstMatch.tap()
    // Back from this Your cutout: Change it (it was opened from there).
    XCTAssertTrue(changeField(app).waitForExistence(timeout: 5))
    // Back from Change it: Your cutout of the piece (canonical Back), whose Use this is Change it again.
    app.buttons["Back"].firstMatch.tap()
    XCTAssertTrue(app.staticTexts["Here's the cutout of your art. Fix the edges if you need to."].waitForExistence(timeout: 5),
                  "Back from Change it: Your cutout of the piece")
    tap(app, "Use this")
    XCTAssertTrue(changeField(app).waitForExistence(timeout: 5))
    XCTAssertTrue(element(app, containing: "Your art", and: "Yellow school bus").exists, "Change it still shows the change on screen")
    XCTAssertEqual(try count("cutout"), 1)
  }

  /// Round 3 order: Adjust the area → Making your cutout (`detect`) → Your cutout → Change it →
  /// "Looks good as is" → Making your sticker → Listing details, from the piece's cut-out (no cutout call).
  func testLooksGoodGoesStraightToTheProduct() throws {
    let app = launchPhotoFlow(code: "TEST-CODE")
    cutPiece(app)
    XCTAssertEqual(try lastBody("detect")["box"] as? [Double], [0, 0, 1200, 1600], "detected inside the frame on the way to Change it")
    XCTAssertEqual(try count("cleanup"), 0, "no cleanup without marks")
    tap(app, "Looks good as is")
    XCTAssertTrue(app.textFields["Name"].waitForExistence(timeout: 20), "straight to Making your sticker, then Listing details")
    XCTAssertFalse(app.staticTexts["Your cutout is ready. Here it is."].exists)
    XCTAssertTrue(try lastBody("cutout").isEmpty, "the drawing's cut-out exists: no cutout call")
    XCTAssertEqual(try lastBody("products")["artworkId"] as? String, "p1", "the original drawing becomes the product")
  }

  /// One drawing in the frame (mock ONE…): Your cutout has no strip of drawings. Then a tote bag
  /// with the tote copy.
  func testSingleDrawingIsCutWithTheFrame() throws {
    let app = launchPhotoFlow(code: "ONE-CODE", product: "Tote bag, Natural canvas")
    XCTAssertTrue(app.otherElements["adjust-area"].waitForExistence(timeout: 20), "Adjust the area right after the photo")
    tap(app, "Use this area")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 15), "Your cutout")
    XCTAssertEqual(try count("detect"), 1)
    XCTAssertFalse(app.buttons["Piece 1"].exists, "one drawing: no strip")
    tap(app, "Use this")
    XCTAssertTrue(app.buttons["Looks good as is"].waitForExistence(timeout: 10), "then Change it")
    XCTAssertTrue(element(app, containing: "WHAT THE IMAGE SHOWS", and: "Cut-out of cand-1").exists)
    app.buttons["Looks good as is"].tap()
    XCTAssertTrue(app.textFields["Name"].waitForExistence(timeout: 20), "Making your tote bag, then Listing details")
    XCTAssertEqual(try lastBody("products")["type"] as? String, "tote")
  }

  /// Round 3 ruling 6: the app is sent to the background while the art is changed and the answer is
  /// lost (mock LOSTCHANGE…: the row is made, the connection dropped). Back in the app the change
  /// is recovered from the server (Before and after, no error) and `change` was made once.
  func testChangeSurvivesTheAppGoingToTheBackground() throws {
    let app = launchPhotoFlow(code: "LOSTCHANGE-CODE")
    cutPiece(app)
    typeChange(app, "Make the sky purple")
    tap(app, "Make the change")
    // The mock takes 2 s to answer: leave the app right away.
    XCUIDevice.shared.press(.home)
    sleep(4)
    app.activate()
    XCTAssertTrue(app.staticTexts["Here's the change"].waitForExistence(timeout: 20), "Before and after, recovered")
    XCTAssertFalse(app.buttons["Try again"].exists)
    XCTAssertEqual(try count("change"), 1, "made once")
    XCTAssertEqual(try count("change-posts"), 1, "and sent once: recovered from the list, not sent again")
    XCTAssertNotNil(try lastBody("change")["clientRequestId"] as? String, "with its request id")
  }

  /// "Make the change" waits for words; the mic button is there with its label.
  func testMakeTheChangeNeedsWords() {
    let app = launchPhotoFlow(code: "ONE-CODE")
    tap(app, "Use this area")
    tap(app, "Use this")
    let make = app.buttons["Make the change"]
    XCTAssertTrue(make.waitForExistence(timeout: 20))
    XCTAssertFalse(make.isEnabled, "dimmed until there is a change")
    XCTAssertTrue(app.buttons["Say what to change"].exists, "the record button reads its label")
    typeChange(app, "Make it blue")
    XCTAssertTrue(make.isEnabled)
    attachScreenshot(app, "change-it")
  }

  /// T122 R4: "Make the change" and "Looks good as is" share one row at the bottom of the change
  /// card, each at least half its width, and nothing is pinned under the content.
  func testChangeButtonsShareOneRow() {
    let app = launchPhotoFlow(code: "ONE-CODE")
    tap(app, "Use this area")
    tap(app, "Use this")
    let make = app.buttons["Make the change"]
    let keep = app.buttons["Looks good as is"]
    XCTAssertTrue(make.waitForExistence(timeout: 20))
    for _ in 0..<3 where !keep.isHittable { app.swipeUp() }
    XCTAssertEqual(make.frame.midY, keep.frame.midY, accuracy: 8, "one row")
    XCTAssertLessThan(make.frame.maxX, keep.frame.minX + 1, "Make the change first")
    XCTAssertGreaterThanOrEqual(make.frame.height, 44)
    XCTAssertGreaterThanOrEqual(keep.frame.height, 44)
    XCTAssertEqual(make.frame.width, keep.frame.width, accuracy: 2, "each takes half the row")
    attachScreenshot(app, "change-it-row")
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

  /// Adjust the area on the whole photo, Making your cutout (`detect`), then Your cutout, whose Use
  /// this goes on to Change it.
  private func cutPiece(_ app: XCUIApplication) {
    XCTAssertTrue(app.otherElements["adjust-area"].waitForExistence(timeout: 20), "Adjust the area right after the photo")
    tap(app, "Use this area")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 15), "Your cutout of the piece")
    tap(app, "Use this")
  }

  private func changeField(_ app: XCUIApplication) -> XCUIElement {
    app.textViews["What to change"].exists ? app.textViews["What to change"] : app.textFields["What to change"]
  }

  private func typeChange(_ app: XCUIApplication, _ text: String) {
    let field = changeField(app)
    XCTAssertTrue(field.waitForExistence(timeout: 10))
    field.tap()
    // Return closes the keyboard, so the tab bar comes back.
    field.typeText(text + "\n")
    // The buttons sit at the bottom of the change card: scroll them into view.
    app.swipeUp()
    XCTAssertTrue(app.buttons["Looks good as is"].waitForExistence(timeout: 3), "the buttons are back")
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
