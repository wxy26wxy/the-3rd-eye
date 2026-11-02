import XCTest

/// Choose a pattern, Adjust the area (T122) and Your cutout against scripts/mock_api.py: the app uses a generated
/// 600 × 800 test photo (UITEST_PHOTO=1), the mock answers two drawings (cand-1 at 100,160–500,693
/// and cand-2 at 660,896–1060,1429 of a 1200 × 1600 original) and records each body at
/// GET /__mock/last/<select|cleanup|cutout>. The test photo shows 302 × 403 pt, so 1 pt ≈ 4 image px.
final class CutoutUITests: XCTestCase {
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

  // MARK: Choose a pattern

  /// One drawing can be picked: a second pick replaces the first; "Use this" opens Adjust the area,
  /// whose "Use this area" cuts that one out with the frame (T122: no `select`).
  func testOneDrawingIsPicked() throws {
    let app = launchPhotoFlow(code: "TEST-CODE")
    let first = app.buttons["Piece 1"]
    XCTAssertTrue(first.waitForExistence(timeout: 20), "Choose a pattern shows the drawings")
    XCTAssertTrue(app.staticTexts["Tap the one you want."].exists)
    XCTAssertTrue(app.staticTexts["We found 2 drawings in your photo. Pick one to change and turn into a sticker."].exists)
    XCTAssertFalse(first.isSelected)
    XCTAssertFalse(app.buttons["Use this"].isEnabled, "nothing picked yet")
    first.tap()
    XCTAssertTrue(app.buttons["Piece 1"].isSelected)
    app.buttons["Piece 2"].tap()
    XCTAssertTrue(app.buttons["Piece 2"].isSelected)
    XCTAssertFalse(app.buttons["Piece 1"].isSelected, "single pick")
    attachScreenshot(app, "choose-a-pattern")
    tap(app, "Use this")
    XCTAssertTrue(app.otherElements["adjust-area"].waitForExistence(timeout: 10), "Adjust the area")
    XCTAssertTrue(try lastBody("cleanup").isEmpty, "nothing is cut before Use this area")
    tap(app, "Use this area")
    XCTAssertTrue(app.buttons["Looks good as is"].waitForExistence(timeout: 10), "goes on to Change it")
    let body = try lastBody("cleanup")
    XCTAssertEqual(body["candidateIds"] as? [String], ["cand-2"])
    // cand-2 = 660,896–1060,1429 grown by 8 % (16 px and 21.3 px on each side).
    let box = try XCTUnwrap(body["box"] as? [Double])
    for (sent, expected) in zip(box, [644.0, 874.7, 1076, 1450.3]) { XCTAssertEqual(sent, expected, accuracy: 1) }
    XCTAssertTrue(try lastBody("select").isEmpty)
  }

  /// A tap on a drawing in the photo picks it.
  func testTapOnThePhotoPicksTheDrawing() {
    let app = launchPhotoFlow(code: "TEST-CODE")
    let photo = app.otherElements["pattern-photo"].exists ? app.otherElements["pattern-photo"] : app.images["pattern-photo"]
    XCTAssertTrue(photo.waitForExistence(timeout: 20))
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: 0.27)).tap()
    XCTAssertTrue(app.buttons["Piece 1"].isSelected, "the drawing under the tap is picked")
  }

  /// Retake drops the photo and the pick; the next photo starts clean.
  func testRetakeClearsThePick() {
    let app = launchPhotoFlow(code: "TEST-CODE")
    let piece = app.buttons["Piece 1"]
    XCTAssertTrue(piece.waitForExistence(timeout: 20))
    piece.tap()
    tap(app, "Retake")
    XCTAssertTrue(app.buttons["Piece 1"].waitForExistence(timeout: 20), "a new photo was taken")
    XCTAssertFalse(app.buttons["Piece 1"].isSelected, "the old pick is gone")
  }

  // MARK: Adjust the area (T122)

  /// A corner dragged out grows the frame; "Use this area" sends the piece with the new frame in
  /// image pixels (4 px per pt on the 302 pt wide photo). Reset puts the frame back.
  func testDraggedCornerIsSent() throws {
    let app = openAdjustArea(code: "TEST-CODE")
    let area = app.otherElements["adjust-area"]
    XCTAssertFalse(app.buttons["Reset"].isEnabled, "nothing to reset yet")
    // cand-1 grown by 8 %: 84,138.7–516,714.3 of 1200 × 1600; its bottom-right corner.
    let corner = area.coordinate(withNormalizedOffset: CGVector(dx: 516.0 / 1200, dy: 714.3 / 1600))
    corner.press(forDuration: 0.3, thenDragTo: area.coordinate(withNormalizedOffset: CGVector(dx: 0.7, dy: 0.6)))
    XCTAssertTrue(app.buttons["Reset"].isEnabled, "the frame moved")
    attachScreenshot(app, "adjust-the-area")
    tap(app, "Reset")
    XCTAssertFalse(app.buttons["Reset"].isEnabled, "back where it started")
    corner.press(forDuration: 0.3, thenDragTo: area.coordinate(withNormalizedOffset: CGVector(dx: 0.7, dy: 0.6)))
    tap(app, "Use this area")
    XCTAssertTrue(app.buttons["Looks good as is"].waitForExistence(timeout: 10), "Change it")
    let body = try lastBody("cleanup")
    XCTAssertEqual(body["candidateIds"] as? [String], ["cand-1"], "the picked piece goes with the frame")
    let box = try XCTUnwrap(body["box"] as? [Double])
    XCTAssertEqual(box[0], 84, accuracy: 1, "the left edge stayed")
    XCTAssertEqual(box[1], 138.7, accuracy: 1, "the top edge stayed")
    XCTAssertEqual(box[2], 840, accuracy: 48, "the right edge followed the drag")
    XCTAssertEqual(box[3], 960, accuracy: 48, "the bottom edge followed the drag")
  }

  /// A drag that starts outside the frame does not move it (it is the screen's scroll).
  func testDragOutsideTheFrameLeavesIt() {
    let app = openAdjustArea(code: "TEST-CODE")
    let area = app.otherElements["adjust-area"]
    area.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.2))
      .press(forDuration: 0.3, thenDragTo: area.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.3)))
    XCTAssertFalse(app.buttons["Reset"].isEnabled, "the frame did not move")
  }

  /// No drawing found (mock NONE…): straight to Adjust the area (no Choose a pattern); the frame
  /// starts on the whole photo and is sent alone.
  func testNoDrawingUsesTheWholePhoto() throws {
    let app = launchPhotoFlow(code: "NONE-CODE")
    XCTAssertTrue(app.otherElements["adjust-area"].waitForExistence(timeout: 20), "Adjust the area on the whole photo")
    let line = "We couldn't find your drawing, so the frame covers the whole photo. Drag the corners around it."
    XCTAssertTrue(app.staticTexts[line].exists)
    XCTAssertFalse(app.buttons["Retake"].exists, "no Choose a pattern step")
    tap(app, "Use this area")
    XCTAssertTrue(app.buttons["Looks good as is"].waitForExistence(timeout: 10), "a cut-out exists, so Change it")
    let body = try lastBody("cleanup")
    XCTAssertEqual(body["box"] as? [Double], [0, 0, 1200, 1600], "the whole photo")
    XCTAssertNil(body["candidateIds"])
  }

  /// A cut that fails (mock NOCUT…: 422) shows the server's reason and stays on the screen.
  func testFailedCutShowsTheReason() {
    let app = openAdjustArea(code: "NOCUT-CODE")
    tap(app, "Use this area")
    XCTAssertTrue(element(app, containing: "Nothing was left in the cutout.").waitForExistence(timeout: 10))
    XCTAssertTrue(app.buttons["Use this area"].isEnabled, "it can be tried again")
  }

  /// Switching tabs while the cut runs (mock SLOW…: 4 s) does not lose it: Change it follows.
  func testCutSurvivesATabSwitch() throws {
    let app = openAdjustArea(code: "SLOW-CODE")
    tap(app, "Use this area")
    app.tabBars.buttons["My designs"].tap()
    XCTAssertTrue(app.buttons["Blue bird on a branch, In the shop"].waitForExistence(timeout: 10))
    sleep(5)
    app.tabBars.buttons["Create"].tap()
    XCTAssertTrue(app.buttons["Looks good as is"].waitForExistence(timeout: 10), "the cut went on to Change it")
    XCTAssertEqual(try lastBody("cleanup")["candidateIds"] as? [String], ["cand-1"])
  }

  // MARK: Your cutout (simplified, T122 R3)

  /// Only the cut-out, the status line, "Use this" and "Start over": no edge tools.
  func testYourCutoutHasNoEdgeTools() throws {
    let app = openYourCutout(code: "TEST-CODE")
    attachScreenshot(app, "your-cutout")
    XCTAssertTrue(app.otherElements["cutout-applied"].exists || app.images["cutout-applied"].exists)
    for gone in ["Fix the edges", "Apply cutout", "Add area", "Remove area", "Draw a box", "Clear marks"] {
      XCTAssertFalse(app.buttons[gone].exists, "\(gone) is gone")
    }
    XCTAssertTrue(app.buttons["Start over"].exists)
    let cuts = try lastBody("cleanup")
    tap(app, "Use this")
    XCTAssertTrue(app.buttons["Approve and list it"].waitForExistence(timeout: 20), "Making your sticker, then Listing details")
    XCTAssertEqual(try lastBody("cleanup") as NSDictionary, cuts as NSDictionary, "Your cutout sends no cleanup")
  }

  /// The cutout of a change answered 422 (mock NOCUTOUT…): Making your cutout shows the reason with
  /// Try again and Back to my art; back goes to Before and after.
  func testCutoutFailureOffersTryAgain() {
    let app = openAdjustArea(code: "NOCUTOUT-CODE")
    tap(app, "Use this area")
    typeChange(app)
    tap(app, "Make the change")
    tap(app, "Use this")
    XCTAssertTrue(element(app, containing: "nothing found in the edited picture").waitForExistence(timeout: 15), "422 shows the server's message")
    XCTAssertTrue(app.buttons["Try again"].exists)
    app.buttons["Back to my art"].tap()
    XCTAssertTrue(app.staticTexts["Here's the change"].waitForExistence(timeout: 5), "back on Before and after")
  }

  /// Start over drops everything and opens the photo picker again.
  func testStartOverTakesANewPhoto() {
    let app = openYourCutout(code: "TEST-CODE")
    tap(app, "Start over")
    XCTAssertTrue(app.buttons["Piece 1"].waitForExistence(timeout: 20), "a new photo, its drawings")
    XCTAssertFalse(app.buttons["Piece 1"].isSelected)
  }

  // MARK: Helpers

  private func launchPhotoFlow(code: String) -> XCUIApplication {
    let app = XCUIApplication()
    self.app = app
    app.launchEnvironment["UITEST_PHOTO"] = "1"
    app.launchEnvironment["MOCK_BLOB_API"] = mockAPIURL.appendingPathComponent("blob").absoluteString + "/"
    app.launch()
    signIn(app, code: code)
    let sticker = app.buttons["Sticker, Die-cut, waterproof"]
    XCTAssertTrue(sticker.waitForExistence(timeout: 10))
    sticker.tap()
    let upload = app.buttons["Upload a picture, Pick one you already have"]
    XCTAssertTrue(upload.waitForExistence(timeout: 5))
    upload.tap()
    return app
  }

  /// Piece 1 picked: Adjust the area with the frame on it.
  private func openAdjustArea(code: String) -> XCUIApplication {
    let app = launchPhotoFlow(code: code)
    let piece = app.buttons["Piece 1"]
    XCTAssertTrue(piece.waitForExistence(timeout: 20))
    piece.tap()
    tap(app, "Use this")
    XCTAssertTrue(app.otherElements["adjust-area"].waitForExistence(timeout: 10), "Adjust the area")
    return app
  }

  private func typeChange(_ app: XCUIApplication) {
    let field = app.textViews["What to change"].exists ? app.textViews["What to change"] : app.textFields["What to change"]
    XCTAssertTrue(field.waitForExistence(timeout: 10))
    field.tap()
    field.typeText("Make the sky purple\n")
    app.swipeUp()
  }

  /// Piece 1 cut with its frame and changed ("Make the sky purple" → ch1), kept with "Use this":
  /// Your cutout of the change.
  private func openYourCutout(code: String) -> XCUIApplication {
    let app = openAdjustArea(code: code)
    tap(app, "Use this area")
    typeChange(app)
    tap(app, "Make the change")
    tap(app, "Use this")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 20), "Your cutout")
    return app
  }

  private func element(_ app: XCUIApplication, containing text: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
  }

  private func tap(_ app: XCUIApplication, _ label: String) {
    let button = app.buttons[label]
    XCTAssertTrue(button.waitForExistence(timeout: 10), "\(label) is shown")
    for _ in 0..<3 where !button.isHittable { app.swipeUp() }
    XCTAssertTrue(button.isEnabled, "\(label) is enabled")
    button.tap()
  }

  private func attachScreenshot(_ app: XCUIApplication, _ name: String) {
    let shot = XCTAttachment(screenshot: app.screenshot())
    shot.name = name
    shot.lifetime = .keepAlways
    add(shot)
  }
}
