import XCTest

/// Photo branch against scripts/mock_api.py: the app uses a generated 600 × 800 test photo
/// (UITEST_PHOTO=1), uploads it to the mock's blob endpoint, and the mock answers two pieces
/// and imageSize 1200 × 1600. The mock records each cleanup body at GET /__mock/last/cleanup.
final class AdjustCutoutUITests: XCTestCase {
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

  /// Two pieces picked → "Use this" sends one cleanup with both ids.
  func testTwoPiecesAreCombined() throws {
    let app = launchPhotoFlow(code: "TEST-CODE")

    let first = app.buttons["Piece 1"]
    XCTAssertTrue(first.waitForExistence(timeout: 20), "Adjust cutout shows the pieces")
    XCTAssertFalse(first.isSelected)
    first.tap()
    XCTAssertTrue(app.buttons["Piece 1"].isSelected, "the chip reads as selected")
    app.buttons["Piece 2"].tap()
    XCTAssertTrue(app.buttons["Piece 2"].isSelected)

    tapUseThis(app)
    XCTAssertTrue(app.staticTexts["Put it up for sale now?"].waitForExistence(timeout: 10), "goes on to Design ready")
    let body = try lastBody("cleanup")
    XCTAssertEqual(body["candidateIds"] as? [String], ["cand-1", "cand-2"])
    XCTAssertNil(body["points"])
  }

  /// An "Add area" tap in the middle of the photo is sent in pixels of the 1200 × 1600 original,
  /// and the preview replaces the photo until "Back to photo".
  func testAddAreaTapIsSentInImagePixels() throws {
    let app = launchPhotoFlow(code: "TEST-CODE")

    let photo = app.otherElements["cutout-photo"]
    XCTAssertTrue(photo.waitForExistence(timeout: 20))
    app.buttons["Piece 1"].tap()
    XCTAssertTrue(app.buttons["Add area"].isSelected, "Add area is the starting mode")
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    XCTAssertTrue(app.buttons["Added area, mark 1"].waitForExistence(timeout: 3), "the mark is shown")

    let apply = app.buttons["Apply cutout"]
    if !apply.isHittable { app.swipeUp() }
    apply.tap()
    let back = app.buttons["Back to photo"]
    XCTAssertTrue(back.waitForExistence(timeout: 10), "the saved cutout is shown with a way back")
    XCTAssertTrue(app.otherElements["cutout-applied"].exists)

    let body = try lastBody("cleanup")
    XCTAssertEqual(body["candidateIds"] as? [String], ["cand-1"])
    let point = try XCTUnwrap((body["points"] as? [[String: Any]])?.first)
    XCTAssertEqual(point["label"] as? String, "positive")
    XCTAssertEqual(try XCTUnwrap(point["x"] as? Double), 600, accuracy: 20)
    XCTAssertEqual(try XCTUnwrap(point["y"] as? Double), 800, accuracy: 20)

    back.tap()
    XCTAssertTrue(photo.waitForExistence(timeout: 3), "back to the photo with the marks")
  }

  /// The piece actions VoiceOver offers are also in the thumbnail's context menu (XCUITest cannot
  /// run VoiceOver custom actions): "Box around this piece" sends that piece's bbox as the box.
  func testBoxAroundPieceAction() throws {
    let app = launchPhotoFlow(code: "TEST-CODE")
    let piece = app.buttons["Piece 2"]
    XCTAssertTrue(piece.waitForExistence(timeout: 20))
    piece.press(forDuration: 1.2)
    let action = app.buttons["Box around this piece"]
    XCTAssertTrue(action.waitForExistence(timeout: 5), "the context menu offers the piece actions")
    action.tap()
    let apply = app.buttons["Apply cutout"]
    if !apply.isHittable { app.swipeUp() }
    apply.tap()
    XCTAssertTrue(app.buttons["Back to photo"].waitForExistence(timeout: 10))
    let body = try lastBody("cleanup")
    XCTAssertEqual(body["box"] as? [Double], [660, 896, 1060, 1429])
    XCTAssertNil(body["candidateIds"], "no piece was picked")
  }

  /// A cleanup without "Remove area" marks answered 422 shows the server's reason, not the advice.
  func testNothingFoundShowsServerReason() {
    let app = launchPhotoFlow(code: "NOCUT-CODE")
    let piece = app.buttons["Piece 1"]
    XCTAssertTrue(piece.waitForExistence(timeout: 20))
    piece.tap()
    app.buttons["Piece 2"].tap()
    tapUseThis(app)
    let reason = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Nothing was left in the cutout.")).firstMatch
    XCTAssertTrue(reason.waitForExistence(timeout: 10), "422 shows the server's message")
    XCTAssertFalse(app.staticTexts["Put it up for sale now?"].exists, "stays on the screen")
  }

  /// A cleanup with a "Remove area" mark answered 422 explains how to trim instead.
  func testNothingFoundAfterRemoveMarkShowsAdvice() {
    let app = launchPhotoFlow(code: "NOCUT-CODE")
    let photo = app.otherElements["cutout-photo"]
    XCTAssertTrue(photo.waitForExistence(timeout: 20))
    app.buttons["Piece 1"].tap()
    app.buttons["Piece 2"].tap()
    app.buttons["Remove area"].tap()
    // Inside piece 1 (bbox 100,160 to 500,693 of 1200 × 1600).
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: 0.27)).tap()
    XCTAssertTrue(app.buttons["Left out, mark 1"].waitForExistence(timeout: 3))
    tapUseThis(app)
    // The error card reads exactly the advice; the Remove area instruction adds a VoiceOver line.
    let advice = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@",
      "Tap a piece to leave it out of the cutout. To trim one piece, draw a box around what should stay.")).firstMatch
    XCTAssertTrue(advice.waitForExistence(timeout: 10), "422 after a Remove area mark is explained")
    XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Nothing was left in the cutout.")).firstMatch.exists)
  }

  /// Redo: Apply saves a different cut, then going back to the opening pieces must cut again on
  /// "Use this" (the server now has the applied cut, not the opening one).
  func testUseThisAfterApplyThenRevertCutsAgain() throws {
    let app = launchPhotoFlow(code: "ONE-CODE")
    let adjust = app.buttons["Adjust cutout"]
    XCTAssertTrue(adjust.waitForExistence(timeout: 20))
    adjust.tap()
    let piece = app.buttons["Piece 1"]
    XCTAssertTrue(piece.waitForExistence(timeout: 5))
    piece.press(forDuration: 1.2)
    let addArea = app.buttons["Add the area around this piece"]
    XCTAssertTrue(addArea.waitForExistence(timeout: 5))
    addArea.tap()
    let apply = app.buttons["Apply cutout"]
    if !apply.isHittable { app.swipeUp() }
    apply.tap()
    XCTAssertTrue(app.buttons["Back to photo"].waitForExistence(timeout: 10))
    XCTAssertNotNil(try lastBody("cleanup")["points"], "the applied cut had the mark")

    app.buttons["Back to photo"].tap()
    let clear = app.buttons["Clear marks"]
    XCTAssertTrue(clear.waitForExistence(timeout: 3))
    clear.tap()
    tapUseThis(app)
    XCTAssertTrue(app.buttons["Adjust cutout"].waitForExistence(timeout: 10), "back on Design ready")
    let body = try lastBody("cleanup")
    XCTAssertEqual(body["candidateIds"] as? [String], ["cand-1"])
    XCTAssertNil(body["points"], "the opening pieces were cut again")
  }

  /// Products that could not be rebuilt or went back to draft are explained on Design ready.
  func testProductNoticesReachDesignReady() {
    let app = launchPhotoFlow(code: "DETAILS-CODE")
    let piece = app.buttons["Piece 1"]
    XCTAssertTrue(piece.waitForExistence(timeout: 20))
    piece.tap()
    app.buttons["Piece 2"].tap()
    tapUseThis(app)
    XCTAssertTrue(app.staticTexts["Put it up for sale now?"].waitForExistence(timeout: 10))
    let notice = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@ AND label CONTAINS %@",
                                                      "could not be rebuilt", "too small to print")).firstMatch
    XCTAssertTrue(notice.exists, "both product notices are shown")
  }

  /// One piece: Finding drawings skips to Design ready, which offers "Adjust cutout". Without a
  /// change "Use this" goes straight back; after adding an area it sends cleanup with the piece.
  func testSinglePieceCanBeAdjustedFromDesignReady() throws {
    let app = launchPhotoFlow(code: "ONE-CODE")

    let adjust = app.buttons["Adjust cutout"]
    XCTAssertTrue(adjust.waitForExistence(timeout: 20), "Design ready offers Adjust cutout")
    adjust.tap()
    let piece = app.buttons["Piece 1"]
    XCTAssertTrue(piece.waitForExistence(timeout: 5))
    XCTAssertTrue(piece.isSelected, "the piece already used is selected")
    XCTAssertFalse(app.buttons["Retake"].exists, "redo mode has no Retake")
    tapUseThis(app)
    XCTAssertTrue(app.buttons["Adjust cutout"].waitForExistence(timeout: 10), "back on Design ready")
    XCTAssertTrue(try lastBody("cleanup").isEmpty, "nothing changed, so nothing is cut again")
    XCTAssertTrue(try lastBody("select").isEmpty)

    app.buttons["Adjust cutout"].tap()
    XCTAssertTrue(piece.waitForExistence(timeout: 5))
    piece.press(forDuration: 1.2)
    let addArea = app.buttons["Add the area around this piece"]
    XCTAssertTrue(addArea.waitForExistence(timeout: 5))
    addArea.tap()
    tapUseThis(app)
    XCTAssertTrue(app.buttons["Adjust cutout"].waitForExistence(timeout: 10), "back on Design ready")
    let body = try lastBody("cleanup")
    XCTAssertEqual(body["candidateIds"] as? [String], ["cand-1"])
    let point = try XCTUnwrap((body["points"] as? [[String: Any]])?.first)
    XCTAssertEqual(point["x"] as? Double, 300)
    XCTAssertEqual(point["y"] as? Double, 426.5)
  }

  /// "Leave this piece out" is offered only for a piece that is in the cutout (T082 R4); the
  /// context menu mirrors the VoiceOver actions, which XCUITest cannot list.
  func testLeaveOutOnlyOnSelectedPieces() {
    let app = launchPhotoFlow(code: "TEST-CODE")
    let piece = app.buttons["Piece 1"]
    XCTAssertTrue(piece.waitForExistence(timeout: 20))
    XCTAssertFalse(piece.isSelected)
    piece.press(forDuration: 1.2)
    XCTAssertTrue(app.buttons["Box around this piece"].waitForExistence(timeout: 5))
    XCTAssertFalse(app.buttons["Leave this piece out"].exists, "not offered for an unselected piece")
    app.buttons["Add the area around this piece"].tap()
    piece.tap()
    XCTAssertTrue(app.buttons["Piece 1"].isSelected)
    piece.press(forDuration: 1.2)
    let leaveOut = app.buttons["Leave this piece out"]
    XCTAssertTrue(leaveOut.waitForExistence(timeout: 5), "offered once selected")
    leaveOut.tap()
    XCTAssertFalse(app.buttons["Piece 1"].isSelected, "and it leaves the piece out")
  }

  /// Switching tabs while Apply runs does not lose the cut the server saves (T082 R2): the mock
  /// takes 4 s (SLOW…), and the saved cutout is there on return.
  func testApplySurvivesATabSwitch() throws {
    let app = launchPhotoFlow(code: "SLOW-CODE")
    let piece = app.buttons["Piece 1"]
    XCTAssertTrue(piece.waitForExistence(timeout: 20))
    piece.tap()
    let apply = app.buttons["Apply cutout"]
    if !apply.isHittable { app.swipeUp() }
    apply.tap()
    app.tabBars.buttons["My designs"].tap()
    XCTAssertTrue(app.buttons["Blue bird on a branch, In the shop"].waitForExistence(timeout: 10))
    sleep(5)
    app.tabBars.buttons["Create"].tap()
    XCTAssertTrue(app.buttons["Back to photo"].waitForExistence(timeout: 10), "the applied cut is shown")
    XCTAssertEqual(try lastBody("cleanup")["candidateIds"] as? [String], ["cand-1"])
  }

  // MARK: Helpers

  private func launchPhotoFlow(code: String) -> XCUIApplication {
    let app = XCUIApplication()
    self.app = app
    app.launchEnvironment["UITEST_PHOTO"] = "1"
    app.launchEnvironment["MOCK_BLOB_API"] = mockAPIURL.appendingPathComponent("blob").absoluteString + "/"
    app.launch()
    signIn(app, code: code)
    let sticker = app.buttons["Sticker, Die-cut around your art"]
    XCTAssertTrue(sticker.waitForExistence(timeout: 10))
    sticker.tap()
    let upload = app.buttons["Upload a picture, Pick art from your photos"]
    XCTAssertTrue(upload.waitForExistence(timeout: 5))
    upload.tap()
    return app
  }

  private func tapUseThis(_ app: XCUIApplication) {
    let use = app.buttons["Use this"]
    XCTAssertTrue(use.waitForExistence(timeout: 5))
    if !use.isHittable { app.swipeUp() }
    XCTAssertTrue(use.isEnabled)
    use.tap()
  }
}
