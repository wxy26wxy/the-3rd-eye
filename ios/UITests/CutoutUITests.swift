import XCTest

/// Choose a pattern and Your cutout (T114) against scripts/mock_api.py: the app uses a generated
/// 600 × 800 test photo (UITEST_PHOTO=1), the mock answers two drawings (cand-1 at 100,160–500,693
/// and cand-2 at 660,896–1060,1429 of a 1200 × 1600 original) and records each body at
/// GET /__mock/last/<select|cleanup|cutout>.
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

  /// One drawing can be picked: a second pick replaces the first; "Use this" cuts that one out.
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
    XCTAssertTrue(app.buttons["Looks good as is"].waitForExistence(timeout: 10), "goes on to Change it")
    XCTAssertEqual(try lastBody("select")["candidateId"] as? String, "cand-2")
    XCTAssertTrue(try lastBody("cleanup").isEmpty)
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

  // MARK: Your cutout

  /// "Fix the edges", an "Add area" tap, Apply: the piece goes with the point (image pixels) and
  /// the new cut-out is shown.
  func testAddAreaIsSentWithThePiece() throws {
    let app = openYourCutout(code: "TEST-CODE")
    attachScreenshot(app, "your-cutout")
    tap(app, "Fix the edges")
    let photo = app.otherElements["cutout-photo"]
    XCTAssertTrue(photo.waitForExistence(timeout: 10))
    XCTAssertTrue(app.buttons["Add area"].isSelected, "Add area is the starting mode")
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    XCTAssertTrue(app.buttons["Added area, mark 1"].waitForExistence(timeout: 3), "the mark is shown")
    tap(app, "Apply cutout")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 10), "the new cut is shown")

    let body = try lastBody("cleanup")
    XCTAssertEqual(body["candidateIds"] as? [String], ["cand-1"], "the piece the cut-out was made from")
    let point = try XCTUnwrap((body["points"] as? [[String: Any]])?.first)
    XCTAssertEqual(point["label"] as? String, "positive")
    XCTAssertEqual(try XCTUnwrap(point["x"] as? Double), 600, accuracy: 20)
    XCTAssertEqual(try XCTUnwrap(point["y"] as? Double), 800, accuracy: 20)
    XCTAssertFalse(app.buttons["Apply cutout"].isEnabled, "nothing new to apply")
  }

  /// "Remove area" alone would drop the whole piece: refused with the advice; with a box it is sent.
  func testRemoveAreaNeedsABox() throws {
    let app = openYourCutout(code: "TEST-CODE")
    app.buttons["Remove area"].tap()
    let photo = app.otherElements["cutout-photo"]
    XCTAssertTrue(photo.waitForExistence(timeout: 10))
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: 0.27)).tap()
    let advice = "To trim the edges, draw a box around what should stay, then tap the parts to leave out."
    XCTAssertTrue(app.staticTexts[advice].waitForExistence(timeout: 3), "refused with the advice")
    XCTAssertFalse(app.buttons["Left out, mark 1"].exists)

    app.buttons["Draw a box"].tap()
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.55)).press(forDuration: 0.3, thenDragTo: photo.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.9)))
    XCTAssertTrue(app.buttons["Clear marks"].waitForExistence(timeout: 3), "the box is drawn")
    app.buttons["Remove area"].tap()
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: 0.27)).tap()
    XCTAssertTrue(app.buttons["Left out, mark 1"].waitForExistence(timeout: 3), "allowed with a box")
    tap(app, "Apply cutout")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 10))
    let body = try lastBody("cleanup")
    XCTAssertEqual(body["candidateIds"] as? [String], ["cand-1"])
    XCTAssertEqual((body["box"] as? [Double])?.count, 4)
    XCTAssertEqual((body["points"] as? [[String: Any]])?.first?["label"] as? String, "negative")
  }

  /// "Draw a box": a drag on the photo is sent as the box, in image pixels.
  func testDraggedBoxIsSent() throws {
    let app = openYourCutout(code: "TEST-CODE")
    app.buttons["Draw a box"].tap()
    let photo = app.otherElements["cutout-photo"]
    XCTAssertTrue(photo.waitForExistence(timeout: 10))
    let start = photo.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.55))
    let end = photo.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.9))
    start.press(forDuration: 0.3, thenDragTo: end)
    XCTAssertTrue(app.buttons["Clear marks"].waitForExistence(timeout: 3), "the box is drawn")
    tap(app, "Use this")
    XCTAssertTrue(app.textFields["Name"].waitForExistence(timeout: 20), "the cut is made, then the sticker")
    let box = try XCTUnwrap(try lastBody("cleanup")["box"] as? [Double])
    XCTAssertEqual(box.count, 4)
    for (sent, expected) in zip(box, [240.0, 880, 1080, 1440]) {
      XCTAssertEqual(sent, expected, accuracy: 48, "within 12 pt of the drag (4 image px per pt)")
    }
  }

  /// A cleanup answered 422 shows the server's reason and stays on the screen.
  func testNothingFoundShowsServerReason() {
    let app = openYourCutout(code: "NOCUT-CODE")
    tap(app, "Fix the edges")
    let photo = app.otherElements["cutout-photo"]
    XCTAssertTrue(photo.waitForExistence(timeout: 10))
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    tap(app, "Use this")
    let reason = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Nothing was left in the cutout.")).firstMatch
    XCTAssertTrue(reason.waitForExistence(timeout: 10), "422 shows the server's message")
    XCTAssertFalse(app.textFields["Name"].exists, "stays on the screen")
  }

  /// Marks go right next to each other and at the photo's edge; a tap on a dot deletes that mark.
  func testMarksGoCloseTogetherAndAtTheEdge() {
    let app = openYourCutout(code: "TEST-CODE")
    tap(app, "Fix the edges")
    let photo = app.otherElements["cutout-photo"]
    XCTAssertTrue(photo.waitForExistence(timeout: 10))
    let centre = photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
    centre.tap()
    XCTAssertTrue(app.buttons["Added area, mark 1"].waitForExistence(timeout: 3))
    centre.withOffset(CGVector(dx: 16, dy: 0)).tap()
    XCTAssertTrue(app.buttons["Added area, mark 2"].waitForExistence(timeout: 3), "16 pt from a mark adds another")
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.995, dy: 0.4)).tap()
    XCTAssertTrue(app.buttons["Added area, mark 3"].waitForExistence(timeout: 3), "a mark at the edge")
    app.buttons["Added area, mark 1"].tap()
    XCTAssertFalse(app.buttons["Added area, mark 3"].waitForExistence(timeout: 2), "a tap on a dot deletes that mark")
    XCTAssertTrue(app.buttons["Added area, mark 2"].exists)
  }

  /// Switching tabs while Apply runs does not lose the cut the server saves (mock SLOW…: 4 s).
  func testApplySurvivesATabSwitch() throws {
    let app = openYourCutout(code: "SLOW-CODE")
    tap(app, "Fix the edges")
    let photo = app.otherElements["cutout-photo"]
    XCTAssertTrue(photo.waitForExistence(timeout: 10))
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    tap(app, "Apply cutout")
    app.tabBars.buttons["My designs"].tap()
    XCTAssertTrue(app.buttons["Blue bird on a branch, In the shop"].waitForExistence(timeout: 10))
    sleep(5)
    app.tabBars.buttons["Create"].tap()
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 10), "the applied cut is shown")
    XCTAssertEqual(try lastBody("cleanup")["candidateIds"] as? [String], ["cand-1"])
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

  /// Piece 1 picked, no change ("Looks good as is"): Your cutout of the drawing's own cut-out.
  private func openYourCutout(code: String) -> XCUIApplication {
    let app = launchPhotoFlow(code: code)
    let piece = app.buttons["Piece 1"]
    XCTAssertTrue(piece.waitForExistence(timeout: 20))
    piece.tap()
    tap(app, "Use this")
    tap(app, "Looks good as is")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 15), "Your cutout")
    return app
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
