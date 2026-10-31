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
    // The message line under the photo (board `21:4450`, in the app's words, T104).
    XCTAssertTrue(app.staticTexts["Tap a piece below to pick it."].exists)
    first.tap()
    XCTAssertTrue(app.buttons["Piece 1"].isSelected, "the chip reads as selected")
    XCTAssertTrue(app.staticTexts["Got piece 1! Tap another piece to add it too."].waitForExistence(timeout: 3))
    app.buttons["Piece 2"].tap()
    XCTAssertTrue(app.buttons["Piece 2"].isSelected)
    XCTAssertTrue(app.staticTexts["Got 2 pieces. They are cut out together."].waitForExistence(timeout: 3), "a second piece is combined")

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

  // MARK: T091

  /// Marks can go right next to another mark, on a piece's number label and at the photo's edge;
  /// a tap on a mark's dot still deletes it (T082 Minor 8).
  func testMarksGoCloseTogetherOnALabelAndAtTheEdge() {
    let app = launchPhotoFlow(code: "TEST-CODE")
    let photo = app.otherElements["cutout-photo"]
    XCTAssertTrue(photo.waitForExistence(timeout: 20))
    let centre = photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
    centre.tap()
    XCTAssertTrue(app.buttons["Added area, mark 1"].waitForExistence(timeout: 3))
    centre.withOffset(CGVector(dx: 16, dy: 0)).tap()
    XCTAssertTrue(app.buttons["Added area, mark 2"].waitForExistence(timeout: 3), "16 pt from a mark adds another")

    // Piece 1's label sits at its top-left corner (bbox 100,160 of 1200 × 1600).
    photo.coordinate(withNormalizedOffset: CGVector(dx: 100.0 / 1200, dy: 160.0 / 1600)).withOffset(CGVector(dx: 12, dy: 12)).tap()
    XCTAssertTrue(app.buttons["Added area, mark 3"].waitForExistence(timeout: 3), "a tap on a label adds a mark")
    XCTAssertFalse(app.buttons["Piece 1"].isSelected, "the label does not pick the piece")

    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.995, dy: 0.4)).tap()
    let edge = app.buttons["Added area, mark 4"]
    XCTAssertTrue(edge.waitForExistence(timeout: 3))
    // XCUITest clips element frames to the photo container, so whether the dot is drawn whole
    // (only the picture is clipped now) is not visible here; the mark exists and is reachable.
    XCTAssertTrue(edge.isHittable, "a mark at the edge is placed and reachable")

    app.buttons["Added area, mark 1"].tap()
    XCTAssertFalse(app.buttons["Added area, mark 4"].waitForExistence(timeout: 2), "a tap on a dot deletes that mark")
    XCTAssertTrue(app.buttons["Added area, mark 3"].exists)
  }

  /// "Draw a box": a drag on the photo is sent as the box, in image pixels.
  func testDraggedBoxIsSent() throws {
    let app = launchPhotoFlow(code: "TEST-CODE")
    let photo = app.otherElements["cutout-photo"]
    XCTAssertTrue(photo.waitForExistence(timeout: 20))
    app.buttons["Draw a box"].tap()
    // Tapping the mode scrolls the page (the photo card and the message line under it push the
    // tools down, T104), so the drag stays in the photo's lower part, which is on screen.
    let start = photo.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.55))
    let end = photo.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.9))
    start.press(forDuration: 0.3, thenDragTo: end)
    XCTAssertTrue(app.buttons["Clear marks"].waitForExistence(timeout: 3), "the box is drawn")
    let apply = app.buttons["Apply cutout"]
    if !apply.isHittable { app.swipeUp() }
    apply.tap()
    XCTAssertTrue(app.buttons["Back to photo"].waitForExistence(timeout: 10))
    let box = try XCTUnwrap(try lastBody("cleanup")["box"] as? [Double])
    XCTAssertEqual(box.count, 4)
    for (sent, expected) in zip(box, [240.0, 880, 1080, 1440]) {
      XCTAssertEqual(sent, expected, accuracy: 48, "within 12 pt of the drag (4 image px per pt)")
    }
  }

  /// "Remove area" on a selected piece while a box is drawn is allowed (the box keeps something)
  /// and sent with the piece, the box and a negative point.
  func testRemoveAreaOnASelectedPieceWithABox() throws {
    let app = launchPhotoFlow(code: "TEST-CODE")
    let photo = app.otherElements["cutout-photo"]
    XCTAssertTrue(photo.waitForExistence(timeout: 20))
    app.buttons["Piece 1"].tap()
    app.buttons["Piece 2"].press(forDuration: 1.2)
    let boxAction = app.buttons["Box around this piece"]
    XCTAssertTrue(boxAction.waitForExistence(timeout: 5))
    boxAction.tap()
    app.buttons["Remove area"].tap()
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: 0.27)).tap()
    XCTAssertTrue(app.buttons["Left out, mark 1"].waitForExistence(timeout: 3), "not refused: the box keeps something")
    let apply = app.buttons["Apply cutout"]
    if !apply.isHittable { app.swipeUp() }
    apply.tap()
    XCTAssertTrue(app.buttons["Back to photo"].waitForExistence(timeout: 10))
    let body = try lastBody("cleanup")
    XCTAssertEqual(body["candidateIds"] as? [String], ["cand-1"])
    XCTAssertEqual(body["box"] as? [Double], [660, 896, 1060, 1429])
    let point = try XCTUnwrap((body["points"] as? [[String: Any]])?.first)
    XCTAssertEqual(point["label"] as? String, "negative")
  }

  /// Retake drops the photo with its marks; the next photo starts clean.
  /// Fails without `CreateFlow.discardPhoto`: the test photo is only used again when the flow has
  /// no photo, so with the old photo kept the camera screen stays and Adjust cutout never returns
  /// (checked by running it with the call removed).
  func testRetakeClearsMarks() {
    let app = launchPhotoFlow(code: "TEST-CODE")
    let photo = app.otherElements["cutout-photo"]
    XCTAssertTrue(photo.waitForExistence(timeout: 20))
    app.buttons["Piece 1"].tap()
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    XCTAssertTrue(app.buttons["Added area, mark 1"].waitForExistence(timeout: 3))
    let retake = app.buttons["Retake"]
    for _ in 0..<3 where !retake.isHittable { app.swipeUp() }
    retake.tap()
    // The test photo is used again, so Adjust cutout comes back for the new answer.
    let piece = app.buttons["Piece 1"]
    XCTAssertTrue(app.otherElements["cutout-photo"].waitForExistence(timeout: 20),
                  "Retake dropped the old photo, so a new one was taken (with the old photo kept, this fails)")
    XCTAssertTrue(piece.waitForExistence(timeout: 5))
    XCTAssertFalse(piece.isSelected, "the old selection is gone")
    XCTAssertFalse(app.buttons["Added area, mark 1"].exists, "the old marks are gone")
    XCTAssertFalse(app.buttons["Clear marks"].exists)
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

  private func tapUseThis(_ app: XCUIApplication) {
    let use = app.buttons["Use this"]
    XCTAssertTrue(use.waitForExistence(timeout: 5))
    if !use.isHittable { app.swipeUp() }
    XCTAssertTrue(use.isEnabled)
    use.tap()
  }
}
