import XCTest

/// Photo first, then "Change it" (T114, round 4 ruling 2) against scripts/mock_api.py: the app uses
/// the generated test photo (UITEST_PHOTO=1); the mock finds two drawings in the crop, `products`
/// makes pr-new-<type> (p1) and pr-ch<n>-<type>, `change` makes child rows ch1, ch2… with a
/// description, and `cutout` cuts a changed picture. Bodies are read back with GET
/// /__mock/last/<route>, counts with /__mock/count/<route>.
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

  /// Ruling 2: Your cutout › Use this → Change it makes the sticker (one POST /products) and shows
  /// its photo → type a change → Changing (change → cutout → products) → Before and after with the
  /// two product photos → Use this → Change it shows the change's photo at once → Looks good as is →
  /// Listing details on the change's product, with no further product call.
  func testChangeRebuildsTheProduct() throws {
    let app = launchPhotoFlow(code: "TEST-CODE")
    cutPiece(app)
    XCTAssertEqual(try count("products"), 1, "the sticker is made before Change it")
    XCTAssertEqual(try lastBody("products")["artworkId"] as? String, "p1")
    XCTAssertTrue(app.staticTexts["WHAT SHOULD I CHANGE?"].exists, "Change it")
    typeChange(app, "Make the sky purple")
    tap(app, "Make the change")

    XCTAssertTrue(app.staticTexts["Here's the change"].waitForExistence(timeout: 20), "Before and after")
    XCTAssertTrue(app.staticTexts["Your sticker, before and after"].exists)
    XCTAssertTrue(element(app, containing: "YOU ASKED", and: "Make the sky purple").exists, "the request is one card")
    XCTAssertTrue(element(app, containing: "WHAT THE IMAGE SHOWS", and: "The sky above it is purple now.").exists,
                  "the description of the change is shown as text")
    XCTAssertTrue(app.descendants(matching: .any)["before-product"].exists, "the product before")
    XCTAssertTrue(app.descendants(matching: .any)["after-product"].exists, "the product after")
    XCTAssertTrue(app.buttons["Change it again"].exists)
    XCTAssertTrue(app.buttons["Back to my original"].exists)
    XCTAssertTrue(app.buttons["Fix the cutout"].exists)
    let change = try lastBody("change")
    XCTAssertEqual(change["artworkId"] as? String, "p1", "the picked drawing is changed")
    XCTAssertEqual(change["instruction"] as? String, "Make the sky purple")
    XCTAssertNil(change["transcript"], "a typed change sends no transcript")
    XCTAssertEqual(try lastBody("cutout")["artworkId"] as? String, "ch1", "the change is cut out")
    XCTAssertEqual(try count("cutout"), 1)
    XCTAssertEqual(try count("products"), 2, "one product photo per change")
    XCTAssertEqual(try count("products/ch1"), 1)
    XCTAssertEqual(try lastBody("products")["artworkId"] as? String, "ch1")
    attachScreenshot(app, "before-and-after")

    tap(app, "Use this")
    XCTAssertTrue(productPhoto(app).waitForExistence(timeout: 3), "Change it shows the change's photo at once")
    XCTAssertFalse(app.descendants(matching: .any)["change-making"].exists)
    tap(app, "Looks good as is")
    XCTAssertTrue(app.textFields["Name"].waitForExistence(timeout: 20), "Listing details")
    XCTAssertEqual(try count("products"), 2, "no product call on Looks good as is")
    XCTAssertEqual(try lastBody("run")["productId"] as? String, "pr-ch1-sticker", "the listing of the change's product")
  }

  /// "Change it again" edits the change (ch1 → ch2); "Back to my original" steps back one change
  /// (T131: to ch1, the chain kept), and again; "Looks good as is" then lists ch1's product, made
  /// on its Changing (no cutout or product call).
  func testChangeAgainThenBackOneStepAtATime() throws {
    let app = launchPhotoFlow(code: "TEST-CODE")
    cutPiece(app)
    typeChange(app, "Make the sky purple")
    tap(app, "Make the change")
    XCTAssertTrue(app.buttons["Change it again"].waitForExistence(timeout: 20))
    app.buttons["Change it again"].tap()

    let field = changeField(app)
    XCTAssertTrue(field.waitForExistence(timeout: 5), "back on Change it")
    XCTAssertTrue(productPhoto(app).exists, "the change's product photo at once")
    XCTAssertTrue(element(app, containing: "WHAT THE IMAGE SHOWS", and: "purple now").exists, "Change it shows the change")
    XCTAssertNotEqual(field.value as? String, "Make the sky purple", "the field starts empty")
    typeChange(app, "Add a sun")
    tap(app, "Make the change")
    XCTAssertTrue(app.staticTexts["Here's the change"].waitForExistence(timeout: 20))
    XCTAssertEqual(try lastBody("change")["artworkId"] as? String, "ch1", "the second change edits the first")

    app.buttons["Back to my original"].tap()
    XCTAssertTrue(changeField(app).waitForExistence(timeout: 5))
    typeChange(app, "Add a moon")
    tap(app, "Make the change")
    XCTAssertTrue(app.staticTexts["Here's the change"].waitForExistence(timeout: 20))
    XCTAssertEqual(try lastBody("change")["artworkId"] as? String, "ch1", "the chain kept ch1")
    XCTAssertTrue(element(app, containing: "YOU ASKED", and: "Add a moon").exists)
    app.buttons["Back to my original"].tap()
    XCTAssertTrue(changeField(app).waitForExistence(timeout: 5))
    XCTAssertEqual(try count("products"), 4, "p1, ch1, ch2, ch3")
    let cutouts = try count("cutout")
    tap(app, "Looks good as is")
    XCTAssertTrue(app.textFields["Name"].waitForExistence(timeout: 20), "Listing details")
    XCTAssertEqual(try count("cutout"), cutouts, "ch1 was cut on its Changing")
    XCTAssertEqual(try count("products"), 4, "and its product made there")
    XCTAssertEqual(try lastBody("run")["productId"] as? String, "pr-ch1-sticker")
  }

  /// Ruling 2: Change it in the making state (mock SLOW…: products take 4 s) shows the animation and
  /// the hint, with both buttons dimmed; then the photo, and the buttons work.
  func testMakingStateWaitsForTheProduct() throws {
    let app = launchPhotoFlow(code: "SLOW-CODE")
    XCTAssertTrue(app.otherElements["adjust-area"].waitForExistence(timeout: 20))
    tap(app, "Use this area")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 15))
    tap(app, "Use this")
    XCTAssertTrue(app.descendants(matching: .any)["change-making"].waitForExistence(timeout: 5), "the making animation")
    XCTAssertTrue(app.staticTexts["Your sticker is being made"].exists, "the hint")
    let keep = app.buttons["Looks good as is"]
    let make = app.buttons["Make the change"]
    XCTAssertFalse(keep.isEnabled)
    XCTAssertFalse(make.isEnabled)
    attachScreenshot(app, "change-it-making")
    XCTAssertTrue(productPhoto(app).waitForExistence(timeout: 15), "the product photo")
    waitUntilEnabled(keep)
    XCTAssertFalse(app.staticTexts["Your sticker is being made"].exists)
    XCTAssertEqual(try count("products"), 1)
  }

  /// Ruling 2: the app goes to the background while Changing makes the product (mock SLOW…); back in
  /// the app the call still waiting is not sent again: Before and after, two products in all.
  func testBackgroundDuringTheProductStepMakesNoSecondProduct() throws {
    let app = launchPhotoFlow(code: "SLOW-CODE")
    cutPiece(app)
    typeChange(app, "Make the sky purple")
    tap(app, "Make the change")
    XCTAssertTrue(app.staticTexts["Making your sticker…"].waitForExistence(timeout: 15), "the third status line")
    XCUIDevice.shared.press(.home)
    sleep(2)
    app.activate()
    XCTAssertTrue(app.staticTexts["Here's the change"].waitForExistence(timeout: 20), "Before and after")
    XCTAssertFalse(app.buttons["Try again"].exists)
    XCTAssertEqual(try count("products"), 2, "no duplicate")
    XCTAssertEqual(try count("products/ch1"), 1)
  }

  /// Ruling 2: Fix the cutout on Change it → Your cutout → a mark, Apply cutout (the cleanup rebuilds
  /// the product) → Use this → back on Change it with the photo, no second POST /products.
  func testFixTheCutoutRoundTrip() throws {
    let app = launchPhotoFlow(code: "TEST-CODE")
    cutPiece(app)
    tap(app, "Fix the cutout")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 10), "Your cutout")
    tap(app, "Fix the edges")
    let photo = app.otherElements["cutout-photo"]
    XCTAssertTrue(photo.waitForExistence(timeout: 10))
    app.swipeDown()
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.3)).tap()
    tap(app, "Apply cutout")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 15))
    XCTAssertEqual(try lastBody("cleanup-target")["artworkId"] as? String, "p1")
    tap(app, "Use this")
    XCTAssertTrue(changeField(app).waitForExistence(timeout: 10), "back on Change it")
    XCTAssertTrue(productPhoto(app).waitForExistence(timeout: 10), "the rebuilt photo")
    XCTAssertEqual(try count("products"), 1, "the cleanup rebuilt it: no second product")
    app.buttons["Back"].firstMatch.tap()
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 5),
                  "one Change it in the path: Back is the first Your cutout")
  }

  /// Round 4 order: Adjust the area → Making your cutout (the crop, `framed`) → Your cutout → Change
  /// it (the sticker made) → "Looks good as is" → Listing details, from the piece's cut-out.
  func testLooksGoodGoesStraightToTheProduct() throws {
    let app = launchPhotoFlow(code: "TEST-CODE")
    cutPiece(app)
    XCTAssertEqual(try lastBody("artworks")["framed"] as? Bool, true, "the crop was cut on the way to Change it")
    XCTAssertEqual(try count("cleanup"), 0, "no cleanup without marks")
    tap(app, "Looks good as is")
    XCTAssertTrue(app.textFields["Name"].waitForExistence(timeout: 20), "straight to Listing details")
    XCTAssertFalse(app.staticTexts["Your cutout is ready. Here it is."].exists)
    XCTAssertTrue(try lastBody("cutout").isEmpty, "the drawing's cut-out exists: no cutout call")
    XCTAssertEqual(try lastBody("products")["artworkId"] as? String, "p1", "the original drawing becomes the product")
    XCTAssertEqual(try count("products"), 1)
  }

  /// One drawing in the frame (mock ONE…): Your cutout has no strip of drawings. Then a tote bag
  /// with the tote copy.
  func testSingleDrawingIsCutWithTheFrame() throws {
    let app = launchPhotoFlow(code: "ONE-CODE", product: "Tote bag, Natural canvas")
    XCTAssertTrue(app.otherElements["adjust-area"].waitForExistence(timeout: 20), "Adjust the area right after the photo")
    tap(app, "Use this area")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 15), "Your cutout")
    XCTAssertEqual(try count("artworks-posts"), 1)
    XCTAssertEqual(try count("detect"), 0)
    XCTAssertFalse(app.buttons["Piece 1"].exists, "one drawing: no strip")
    tap(app, "Use this")
    XCTAssertTrue(app.buttons["Looks good as is"].waitForExistence(timeout: 10), "then Change it")
    XCTAssertTrue(element(app, containing: "WHAT THE IMAGE SHOWS", and: "Cut-out of cand-1").exists)
    XCTAssertTrue(productPhoto(app).waitForExistence(timeout: 10), "the tote bag photo")
    XCTAssertTrue(element(app, containing: "Your tote bag", and: "Cut-out").exists)
    tap(app, "Looks good as is")
    XCTAssertTrue(app.textFields["Name"].waitForExistence(timeout: 20), "Listing details")
    XCTAssertEqual(try lastBody("products")["type"] as? String, "tote")
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
    XCTAssertTrue(productPhoto(app).waitForExistence(timeout: 10))
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

  /// Adjust the area on the whole photo, Making your cutout (the crop), then Your cutout, whose Use
  /// this goes on to Change it, which makes the product and shows its photo.
  private func cutPiece(_ app: XCUIApplication) {
    XCTAssertTrue(app.otherElements["adjust-area"].waitForExistence(timeout: 20), "Adjust the area right after the photo")
    tap(app, "Use this area")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 15), "Your cutout of the piece")
    tap(app, "Use this")
    XCTAssertTrue(productPhoto(app).waitForExistence(timeout: 20), "Change it with the product photo")
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
    waitUntilEnabled(button, timeout: 10)
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
