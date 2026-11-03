import XCTest

/// Adjust the area (round 4: right after the photo, on the local photo, no upload) and Your cutout
/// (with the marks and, for several drawings, the strip) against scripts/mock_api.py: the app uses a
/// generated 600 × 800 test photo (UITEST_PHOTO=1); "Use this area" uploads the crop (its JPEG size
/// at GET /__mock/last/blob-put) and `POST /artworks {framed: true}` answers two drawings (cand-1 at
/// 100,160–500,693 and cand-2 at 660,896–1060,1429 of a 1200 × 1600 stored crop) and records each
/// body at GET /__mock/last/<artworks|cleanup|cutout> (the cleanup's artwork at
/// /__mock/last/cleanup-target, call counts at /__mock/count/<route>).
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

  // MARK: Round 4 order

  /// Photo → Adjust the area on the local photo with nothing sent → Use this area uploads the crop
  /// once and sends one `POST /artworks {framed: true}` (no `detect`) → Your cutout on the crop with
  /// the strip of the two drawings found, the largest picked; picking the other sends a cleanup
  /// with the whole crop as the box. Back and Use this area unchanged: nothing sent again.
  func testPhotoThenFrameThenCropUpload() throws {
    let app = launchPhotoFlow(code: "TEST-CODE")
    XCTAssertTrue(app.otherElements["adjust-area"].waitForExistence(timeout: 20), "Adjust the area right after the photo")
    XCTAssertTrue(app.staticTexts["Drag the corners so the frame covers your drawing."].exists)
    XCTAssertTrue(app.buttons["Take a new photo"].exists)
    XCTAssertEqual(try count("blob-put"), 0, "no upload before Use this area")
    XCTAssertEqual(try count("artworks-posts"), 0)
    attachScreenshot(app, "adjust-the-area-local-photo")
    tap(app, "Use this area")
    XCTAssertTrue(yourCutout(app).waitForExistence(timeout: 15), "Making your cutout, then Your cutout")
    XCTAssertEqual(try count("blob-put"), 1, "one upload: the crop")
    XCTAssertEqual(try count("artworks-posts"), 1, "one POST /artworks")
    XCTAssertEqual(try count("detect"), 0, "no detect call")
    let sent = try lastBody("artworks")
    XCTAssertEqual(sent["framed"] as? Bool, true)
    XCTAssertNil(sent["detect"])
    let upload = try lastBody("blob-put")
    XCTAssertEqual(upload["width"] as? Int, 600, "the frame on the whole photo: the whole photo")
    XCTAssertEqual(upload["height"] as? Int, 800)
    XCTAssertEqual(try count("cleanup"), 0)
    let first = app.buttons["Piece 1"]
    XCTAssertTrue(first.waitForExistence(timeout: 5), "two drawings in the crop: the strip")
    XCTAssertTrue(first.isSelected, "the largest was cut")
    tap(app, "Piece 2")
    XCTAssertTrue(app.buttons["Piece 2"].waitForExistence(timeout: 10))
    let picked = NSPredicate(format: "isSelected == true")
    expectation(for: picked, evaluatedWith: app.buttons["Piece 2"])
    waitForExpectations(timeout: 15)
    let body = try lastBody("cleanup")
    XCTAssertEqual(body["candidateIds"] as? [String], ["cand-2"])
    XCTAssertEqual(body["box"] as? [Double], [0, 0, 1200, 1600], "the whole stored crop")
    XCTAssertEqual(body["clipToBox"] as? Bool, true)
    XCTAssertNil(body["points"])
    // Back to the frame and Use this area unchanged: no second upload or create.
    app.buttons["Back"].firstMatch.tap()
    XCTAssertTrue(app.otherElements["adjust-area"].waitForExistence(timeout: 5))
    tap(app, "Use this area")
    XCTAssertTrue(yourCutout(app).waitForExistence(timeout: 10))
    XCTAssertEqual(try count("blob-put"), 1, "the same frame is not uploaded again")
    XCTAssertEqual(try count("artworks-posts"), 1)
  }

  // MARK: Adjust the area

  /// The top-left corner dragged in shrinks the frame; "Use this area" uploads a crop of that size
  /// (pixels of the 600 × 800 local photo). Reset puts the frame back; a re-framed area is a new
  /// crop and a new row.
  func testDraggedCornerIsTheCrop() throws {
    let app = openAdjustArea(code: "TEST-CODE")
    let area = app.otherElements["adjust-area"]
    XCTAssertFalse(app.buttons["Reset"].isEnabled, "nothing to reset yet")
    let corner = photoPoint(area, 0, 0)
    corner.press(forDuration: 0.3, thenDragTo: photoPoint(area, 0.3, 0.4))
    XCTAssertTrue(app.buttons["Reset"].isEnabled, "the frame moved")
    tap(app, "Reset")
    XCTAssertFalse(app.buttons["Reset"].isEnabled, "back where it started")
    photoPoint(area, 0, 0).press(forDuration: 0.3, thenDragTo: photoPoint(area, 0.3, 0.4))
    tap(app, "Use this area")
    XCTAssertTrue(yourCutout(app).waitForExistence(timeout: 15), "Your cutout")
    let upload = try lastBody("blob-put")
    XCTAssertEqual(Double(upload["width"] as? Int ?? 0), 420, accuracy: 24, "the left edge followed the drag")
    XCTAssertEqual(Double(upload["height"] as? Int ?? 0), 480, accuracy: 32, "the top edge followed the drag")
    app.buttons["Back"].firstMatch.tap()
    XCTAssertTrue(area.waitForExistence(timeout: 5))
    XCTAssertTrue(app.buttons["Reset"].isEnabled, "back on the frame last used")
    tap(app, "Reset")
    tap(app, "Use this area")
    XCTAssertTrue(yourCutout(app).waitForExistence(timeout: 15))
    XCTAssertEqual(try count("blob-put"), 2, "a re-framed area is a new crop")
    XCTAssertEqual(try count("artworks-posts"), 2, "and a new row")
    XCTAssertEqual(try lastBody("blob-put")["width"] as? Int, 600)
  }

  /// A drag inside a frame over the whole photo does not move it (the screen scrolls).
  func testDragInsideTheWholePhotoFrameLeavesIt() {
    let app = openAdjustArea(code: "TEST-CODE")
    let area = app.otherElements["adjust-area"]
    photoPoint(area, 0.5, 0.4).press(forDuration: 0.3, thenDragTo: photoPoint(area, 0.6, 0.5))
    XCTAssertFalse(app.buttons["Reset"].isEnabled, "the frame did not move")
  }

  /// Fix round 1: the whole-photo frame's corner sits on the photo's edge; a drag that starts
  /// 15 pt outside the photo (inside the handle's 44 pt target) still takes the corner.
  func testWholePhotoCornerDragsFromOutsideThePhoto() throws {
    let app = openAdjustArea(code: "TEST-CODE")
    let area = app.otherElements["adjust-area"]
    let photo = photoSize(area)
    let outside = photoPoint(area, 0, 0).withOffset(CGVector(dx: -15, dy: -15))
    outside.press(forDuration: 0.3, thenDragTo: photoPoint(area, 0.25, 0.25))
    XCTAssertTrue(app.buttons["Reset"].isEnabled, "the corner moved")
    tap(app, "Use this area")
    XCTAssertTrue(yourCutout(app).waitForExistence(timeout: 15))
    let upload = try lastBody("blob-put")
    // The drag ran a quarter of the photo plus the 15 pt it started outside it.
    XCTAssertEqual(Double(upload["width"] as? Int ?? 0), 450 - 15 * 600 / photo.width, accuracy: 24, "the left edge followed the drag")
    XCTAssertEqual(Double(upload["height"] as? Int ?? 0), 600 - 15 * 800 / photo.height, accuracy: 24, "the top edge followed the drag")
  }

  /// Nothing in the crop (mock NONE…: `POST /artworks` answers 422 no_drawing_found): back on Adjust
  /// the area with what to do, and it can be tried again.
  func testNothingInTheFrameComesBackToTheFrame() throws {
    let app = openAdjustArea(code: "NONE-CODE")
    tap(app, "Use this area")
    XCTAssertTrue(element(app, containing: "We couldn't find a drawing in that area.").waitForExistence(timeout: 15))
    XCTAssertTrue(app.otherElements["adjust-area"].exists, "back on Adjust the area")
    XCTAssertFalse(app.buttons["Try again"].exists, "no error screen")
    XCTAssertTrue(app.buttons["Use this area"].isEnabled, "it can be tried again")
    XCTAssertEqual(try count("artworks-posts"), 1)
    XCTAssertEqual(try count("detect"), 0)
  }

  /// Switching tabs while the cut runs does not lose it: Your cutout follows, the crop sent once.
  func testCutSurvivesATabSwitch() throws {
    let app = openAdjustArea(code: "TEST-CODE")
    tap(app, "Use this area")
    app.tabBars.buttons["My designs"].tap()
    XCTAssertTrue(app.buttons["Blue bird on a branch, In the shop"].waitForExistence(timeout: 10))
    sleep(4)
    app.tabBars.buttons["Create"].tap()
    XCTAssertTrue(yourCutout(app).waitForExistence(timeout: 10), "the cut went on to Your cutout")
    XCTAssertEqual(try count("artworks-posts"), 1, "sent once, not again when the tab came back")
    XCTAssertEqual(try count("blob-put"), 1)
  }

  // MARK: Your cutout (T131: the tools are back, without Draw a box)

  /// Your cutout of the piece: the cut-out, Fix the edges, Add area / Remove area, Use this, Apply
  /// cutout, Start over; no "Draw a box". "Use this" sends nothing more and goes on to Change it.
  func testYourCutoutHasTheMarkTools() throws {
    let app = openPieceCutout(code: "TEST-CODE")
    attachScreenshot(app, "your-cutout")
    XCTAssertTrue(app.otherElements["cutout-applied"].exists || app.images["cutout-applied"].exists)
    for shown in ["Fix the edges", "Add area", "Remove area", "Use this", "Apply cutout", "Start over"] {
      XCTAssertTrue(app.buttons[shown].exists, "\(shown) is there")
    }
    XCTAssertFalse(app.buttons["Draw a box"].exists, "the frame is the box")
    XCTAssertFalse(app.buttons["Apply cutout"].isEnabled, "nothing marked yet")
    XCTAssertEqual(try count("cleanup"), 0)
    tap(app, "Use this")
    XCTAssertTrue(app.buttons["Looks good as is"].waitForExistence(timeout: 10), "Change it")
    XCTAssertEqual(try count("cleanup"), 0, "Use this without marks sends nothing")
    XCTAssertEqual(try count("artworks-posts"), 1)
  }

  /// Marks on the piece: two Add area marks and one Remove area mark, a tap on a mark deletes it;
  /// Apply cutout sends the piece, the marks (pixels of the stored crop) and the whole crop as the
  /// box (clipToBox).
  func testMarksApplyOnThePiece() throws {
    let app = openPieceCutout(code: "TEST-CODE")
    tap(app, "Fix the edges")
    let photo = cutoutPhoto(app)
    XCTAssertTrue(photo.waitForExistence(timeout: 10), "the crop for the marks")
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.2)).tap()
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.3)).tap()
    XCTAssertTrue(app.buttons["Added area, mark 2"].waitForExistence(timeout: 5))
    tap(app, "Remove area")
    _ = cutoutPhoto(app)
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.35, dy: 0.25)).tap()
    XCTAssertTrue(app.buttons["Left out, mark 3"].waitForExistence(timeout: 5))
    // A tap on mark 2's dot deletes it.
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.3)).tap()
    XCTAssertFalse(app.buttons["Left out, mark 3"].waitForExistence(timeout: 2), "the marks renumber")
    XCTAssertTrue(app.buttons["Left out, mark 2"].exists)
    attachScreenshot(app, "your-cutout-marks")
    tap(app, "Apply cutout")
    XCTAssertTrue(yourCutout(app).waitForExistence(timeout: 15), "the new cut-out is shown")
    let body = try lastBody("cleanup")
    XCTAssertEqual(try lastBody("cleanup-target")["artworkId"] as? String, "p1")
    XCTAssertEqual(body["candidateIds"] as? [String], ["cand-1"], "the piece goes with the marks")
    XCTAssertEqual(body["clipToBox"] as? Bool, true)
    XCTAssertEqual(body["box"] as? [Double], [0, 0, 1200, 1600], "the whole crop is the box")
    let points = try XCTUnwrap(body["points"] as? [[String: Any]])
    XCTAssertEqual(points.map { $0["label"] as? String }, ["positive", "negative"])
    XCTAssertEqual(points[0]["x"] as? Double ?? 0, 240, accuracy: 40, "a fifth of the 1200 px crop")
    XCTAssertEqual(points[0]["y"] as? Double ?? 0, 320, accuracy: 40)
    XCTAssertFalse(app.buttons["Apply cutout"].isEnabled, "the cut matches the marks")
    tap(app, "Use this")
    XCTAssertTrue(app.buttons["Looks good as is"].waitForExistence(timeout: 10), "Change it")
    XCTAssertEqual(try count("cleanup"), 1, "applied once")
  }

  /// After a change, the same tools act on the change result: cleanup on ch1 with the piece its
  /// cutout found and the whole picture as the box.
  func testMarksApplyOnAChange() throws {
    let app = openYourCutout(code: "TEST-CODE")
    XCTAssertTrue(app.staticTexts["Here's the cutout of your changed art. Fix the edges if you need to."].exists)
    tap(app, "Fix the edges")
    let photo = cutoutPhoto(app)
    XCTAssertTrue(photo.waitForExistence(timeout: 10))
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    XCTAssertTrue(app.buttons["Added area, mark 1"].waitForExistence(timeout: 5))
    tap(app, "Apply cutout")
    XCTAssertTrue(yourCutout(app).waitForExistence(timeout: 15))
    XCTAssertEqual(try lastBody("cleanup-target")["artworkId"] as? String, "ch1", "the change result is cut again")
    let body = try lastBody("cleanup")
    XCTAssertEqual(body["candidateIds"] as? [String], ["cand-1"], "the piece the cutout found")
    XCTAssertEqual(body["box"] as? [Double], [0, 0, 1200, 1600], "the whole picture")
    XCTAssertEqual(body["clipToBox"] as? Bool, true)
    XCTAssertEqual((body["points"] as? [[String: Any]])?.count, 1)
    tap(app, "Use this")
    XCTAssertTrue(productPhoto(app).waitForExistence(timeout: 15), "back on Change it with the change's product photo")
    XCTAssertEqual(try count("products"), 2, "p1 and ch1, made before; the cleanup rebuilt ch1's")
  }

  /// Marks not applied yet are applied by Use this before going on.
  func testUseThisAppliesPendingMarks() throws {
    let app = openPieceCutout(code: "TEST-CODE")
    tap(app, "Fix the edges")
    let photo = cutoutPhoto(app)
    XCTAssertTrue(photo.waitForExistence(timeout: 10))
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: 0.25)).tap()
    tap(app, "Use this")
    XCTAssertTrue(app.buttons["Looks good as is"].waitForExistence(timeout: 15), "Change it")
    XCTAssertEqual((try lastBody("cleanup")["points"] as? [[String: Any]])?.count, 1, "the mark was sent")
  }

  /// The cutout of a change answered 422 (mock NOCUTOUT…): Changing shows the reason with Try again
  /// and Back to my art; back goes to Change it on the art as it was (the change never joined).
  func testCutoutFailureOffersTryAgain() throws {
    let app = openPieceCutout(code: "NOCUTOUT-CODE")
    tap(app, "Use this")
    XCTAssertTrue(productPhoto(app).waitForExistence(timeout: 15))
    typeChange(app)
    tap(app, "Make the change")
    XCTAssertTrue(element(app, containing: "nothing found in the edited picture").waitForExistence(timeout: 15), "422 shows the server's message")
    XCTAssertTrue(app.buttons["Try again"].exists)
    app.buttons["Back to my art"].tap()
    XCTAssertTrue(productPhoto(app).waitForExistence(timeout: 5), "back on Change it with the sticker as it was")
    XCTAssertEqual(try count("products"), 1)
  }

  /// Start over drops everything and goes back to Choose method (T131); the next photo starts clean.
  func testStartOverGoesBackToChooseMethod() {
    let app = openYourCutout(code: "TEST-CODE")
    tap(app, "Start over")
    let upload = app.buttons["Upload a picture, Pick one you already have"]
    XCTAssertTrue(upload.waitForExistence(timeout: 10), "Choose method")
    upload.tap()
    XCTAssertTrue(app.otherElements["adjust-area"].waitForExistence(timeout: 20), "a new photo, on the frame")
    XCTAssertFalse(app.buttons["Reset"].isEnabled, "the frame starts on the whole new photo")
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

  /// The frame element reaches 22 pt past the photo on every side (the handles' touch area, fix
  /// round 1): a point at a share of the photo itself.
  private func photoPoint(_ area: XCUIElement, _ x: CGFloat, _ y: CGFloat) -> XCUICoordinate {
    let size = photoSize(area)
    return area.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: 22 + x * size.width, dy: 22 + y * size.height))
  }

  private func photoSize(_ area: XCUIElement) -> CGSize {
    CGSize(width: area.frame.width - 44, height: area.frame.height - 44)
  }

  /// Adjust the area on the whole photo.
  private func openAdjustArea(code: String) -> XCUIApplication {
    let app = launchPhotoFlow(code: code)
    XCTAssertTrue(app.otherElements["adjust-area"].waitForExistence(timeout: 20), "Adjust the area")
    return app
  }

  private func typeChange(_ app: XCUIApplication) {
    let field = app.textViews["What to change"].exists ? app.textViews["What to change"] : app.textFields["What to change"]
    XCTAssertTrue(field.waitForExistence(timeout: 10))
    field.tap()
    field.typeText("Make the sky purple\n")
    app.swipeUp()
  }

  /// The crop cut: Your cutout of the piece (cand-1, the largest).
  private func openPieceCutout(code: String) -> XCUIApplication {
    let app = openAdjustArea(code: code)
    tap(app, "Use this area")
    XCTAssertTrue(yourCutout(app).waitForExistence(timeout: 20), "Your cutout of the piece")
    return app
  }

  /// "Your cutout is ready. Here it is." (the cut-out is shown).
  private func yourCutout(_ app: XCUIApplication) -> XCUIElement {
    app.staticTexts["Your cutout is ready. Here it is."]
  }

  /// The picture the marks go on, scrolled back to the top so all of it is on screen.
  private func cutoutPhoto(_ app: XCUIApplication) -> XCUIElement {
    app.swipeDown()
    app.swipeDown()
    return photoElement(app)
  }

  private func photoElement(_ app: XCUIApplication) -> XCUIElement {
    app.otherElements["cutout-photo"]
  }

  /// The piece cut, then changed ("Make the sky purple" → ch1), then "Fix the cutout" on Before
  /// and after: Your cutout of the change.
  private func openYourCutout(code: String) -> XCUIApplication {
    let app = openPieceCutout(code: code)
    tap(app, "Use this")
    XCTAssertTrue(productPhoto(app).waitForExistence(timeout: 15))
    typeChange(app)
    tap(app, "Make the change")
    XCTAssertTrue(app.staticTexts["Here's the change"].waitForExistence(timeout: 20))
    tap(app, "Fix the cutout")
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
    waitUntilEnabled(button, timeout: 10)
    button.tap()
  }

  private func attachScreenshot(_ app: XCUIApplication, _ name: String) {
    let shot = XCTAttachment(screenshot: app.screenshot())
    shot.name = name
    shot.lifetime = .keepAlways
    add(shot)
  }
}
