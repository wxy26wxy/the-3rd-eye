import XCTest

/// Listing details' drafting state and My story video (T122 R5, R6) against scripts/mock_api.py:
/// `POST /listings/<id>/run` answers after 2 s; `GET /creators/me` has a story video (sign-in
/// NOVIDEO… has none).
final class ListingStoryUITests: XCTestCase {
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

  /// While the listing is written the drafting card replaces the form (no fields, Approve dimmed);
  /// when the run returns the fields appear filled.
  func testDraftingHidesTheFieldsUntilTheListingIsWritten() {
    let app = launch(code: "ONE-CODE")
    let sticker = app.buttons["Sticker, Die-cut, waterproof"]
    XCTAssertTrue(sticker.waitForExistence(timeout: 10))
    sticker.tap()
    let upload = app.buttons["Upload a picture, Pick one you already have"]
    XCTAssertTrue(upload.waitForExistence(timeout: 5))
    upload.tap()
    let frame = app.buttons["Use this area"]
    XCTAssertTrue(frame.waitForExistence(timeout: 20), "Adjust the area")
    frame.tap()
    let use = app.buttons["Use this"]
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 20), "Your cutout")
    use.tap()
    let keep = app.buttons["Looks good as is"]
    XCTAssertTrue(keep.waitForExistence(timeout: 20))
    for _ in 0..<3 where !keep.isHittable { app.swipeUp() }
    waitUntilEnabled(keep)
    keep.tap()

    let drafting = app.descendants(matching: .any)["listing-drafting"]
    XCTAssertTrue(drafting.waitForExistence(timeout: 20), "the drafting card")
    XCTAssertFalse(app.textFields["Name"].exists, "no fields while the listing is written")
    XCTAssertFalse(app.textFields["Price in dollars"].exists)
    XCTAssertFalse(app.buttons["Approve and list it"].isEnabled, "nothing to approve yet")
    XCTAssertTrue(app.descendants(matching: .any)["listing-picture"].exists, "the product picture while the listing is written")
    XCTAssertTrue(app.buttons["Redo"].exists, "Redo while drafting")
    attachScreenshot(app, "listing-drafting")

    let name = app.textFields["Name"]
    XCTAssertTrue(name.waitForExistence(timeout: 10), "the fields appear when the run returns")
    XCTAssertFalse((name.value as? String ?? "").isEmpty, "filled by the listing agent")
    XCTAssertFalse(drafting.exists)
    XCTAssertTrue(app.buttons["Approve and list it"].isEnabled)
    XCTAssertTrue(app.descendants(matching: .any)["listing-picture"].exists, "the product picture is shown")
    XCTAssertFalse(app.buttons["Redo"].exists, "Redo only while drafting")
  }

  /// Round 3 ruling 5: Redo while the listing is written goes back to Your cutout; "Use this" there
  /// returns to Change it (round 4) with the draft product (no second POST /products), and the
  /// listing is written again.
  func testRedoWhileDraftingGoesBackToTheCutout() throws {
    let app = launch(code: "ONE-CODE")
    goToListing(app)
    let drafting = app.descendants(matching: .any)["listing-drafting"]
    XCTAssertTrue(drafting.waitForExistence(timeout: 20), "the drafting card")
    app.buttons["Redo"].tap()
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 10), "back on Your cutout")
    XCTAssertFalse(app.textFields["Name"].exists)
    app.buttons["Use this"].tap()
    XCTAssertTrue(productPhoto(app).waitForExistence(timeout: 10), "Change it with the product photo")
    let keep = app.buttons["Looks good as is"]
    XCTAssertTrue(keep.waitForExistence(timeout: 20))
    for _ in 0..<3 where !keep.isHittable { app.swipeUp() }
    waitUntilEnabled(keep)
    keep.tap()
    XCTAssertTrue(app.textFields["Name"].waitForExistence(timeout: 30), "the listing is written again")
    XCTAssertEqual(try count("products"), 1, "the draft product is reused")
    XCTAssertEqual(try count("run"), 2)
  }

  /// The run's print check line (mock NOPRINT…: print_check contrast) is on the form.
  func testPrintCheckLineOnTheForm() {
    let app = launch(code: "NOPRINT-CODE")
    goToListing(app)
    XCTAssertTrue(app.textFields["Name"].waitForExistence(timeout: 30))
    let line = app.descendants(matching: .any)["listing-print-check"]
    for _ in 0..<3 where !line.exists { app.swipeUp() }
    XCTAssertTrue(line.exists)
    XCTAssertEqual(line.label, "Print check: the colors may look faint")
  }

  /// Sticker → upload → Adjust the area → Your cutout → Change it (the product made) → Looks good as
  /// is → Listing details.
  private func goToListing(_ app: XCUIApplication) {
    let sticker = app.buttons["Sticker, Die-cut, waterproof"]
    XCTAssertTrue(sticker.waitForExistence(timeout: 10))
    sticker.tap()
    let upload = app.buttons["Upload a picture, Pick one you already have"]
    XCTAssertTrue(upload.waitForExistence(timeout: 5))
    upload.tap()
    let frame = app.buttons["Use this area"]
    XCTAssertTrue(frame.waitForExistence(timeout: 20), "Adjust the area")
    frame.tap()
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitForExistence(timeout: 20), "Your cutout")
    app.buttons["Use this"].tap()
    let keep = app.buttons["Looks good as is"]
    XCTAssertTrue(keep.waitForExistence(timeout: 20))
    for _ in 0..<3 where !keep.isHittable { app.swipeUp() }
    waitUntilEnabled(keep)
    keep.tap()
  }

  /// T131: the listing agent runs by itself on the first visit in every mode (sign-in MULTI… turns
  /// simple mode off): a reused draft without a listing name opens on the drafting card.
  func testListingAgentRunsByItselfWithoutSimpleMode() throws {
    let app = launch(code: "MULTI-CODE")
    app.tabBars.buttons["My designs"].tap()
    let tile = app.buttons["Blue bird on a branch, In the shop"]
    XCTAssertTrue(tile.waitForExistence(timeout: 10))
    tile.tap()
    let make = app.buttons["Make a tote"]
    XCTAssertTrue(make.waitForExistence(timeout: 10))
    for _ in 0..<3 where !make.isHittable { app.swipeUp() }
    make.tap()
    // Ruling 2: no tote yet, so Change it makes it first.
    XCTAssertTrue(productPhoto(app).waitForExistence(timeout: 15), "Change it with the tote bag photo")
    let keep = app.buttons["Looks good as is"]
    for _ in 0..<3 where !keep.isHittable { app.swipeUp() }
    waitUntilEnabled(keep)
    keep.tap()
    let drafting = app.descendants(matching: .any)["listing-drafting"]
    XCTAssertTrue(drafting.waitForExistence(timeout: 30), "the drafting card, without a tap on Improve with AI")
    let name = app.textFields["Name"]
    XCTAssertTrue(name.waitForExistence(timeout: 15))
    XCTAssertEqual(name.value as? String, "Frog King Tote", "written by the listing agent")
    XCTAssertEqual(try count("run"), 1)
    XCTAssertEqual(try lastBody("run")["productId"] as? String, "pr-new-tote")
  }

  /// The Create tab's row says the video is there and opens My story video, whose "Record again"
  /// opens Story video in its redo mode; Cancel comes back.
  func testStoryVideoRowAndRecordAgain() {
    let app = launch(code: "TEST-CODE")
    let row = app.buttons["story-video-row"]
    XCTAssertTrue(row.waitForExistence(timeout: 10), "the row under the product choice")
    XCTAssertTrue(waitForLabel(row, containing: "Recorded"), "it says the video is recorded")
    row.tap()
    XCTAssertTrue(app.buttons["Record again"].waitForExistence(timeout: 10), "My story video")
    XCTAssertTrue(app.buttons["Watch"].exists)
    XCTAssertTrue(app.descendants(matching: .any)["story-player"].exists, "the player")
    let setting = app.descendants(matching: .any)["story-disability"]
    XCTAssertTrue(setting.exists)
    XCTAssertTrue(setting.label.contains("Off"), "the disability setting is shown")
    attachScreenshot(app, "my-story-video")
    app.buttons["Record again"].tap()
    XCTAssertTrue(app.staticTexts["Tell buyers your story"].waitForExistence(timeout: 5), "Story video")
    XCTAssertTrue(app.staticTexts["Your new video replaces this one on all your products."].exists, "in its redo mode")
    XCTAssertFalse(app.buttons["Skip for now"].exists)
    app.buttons["Cancel"].tap()
    XCTAssertTrue(app.buttons["Record again"].waitForExistence(timeout: 5), "back on My story video")
  }

  /// Without a story video (mock NOVIDEO…) the row says so and the screen offers to record one.
  func testNoStoryVideoYet() {
    let app = launch(code: "NOVIDEO-CODE")
    let row = app.buttons["story-video-row"]
    XCTAssertTrue(row.waitForExistence(timeout: 10))
    XCTAssertTrue(waitForLabel(row, containing: "No story video yet"))
    row.tap()
    XCTAssertTrue(app.buttons["Record my video"].waitForExistence(timeout: 10))
    XCTAssertFalse(app.buttons["Record again"].exists)
  }

  // MARK: Helpers

  private func launch(code: String) -> XCUIApplication {
    let app = XCUIApplication()
    self.app = app
    app.launchEnvironment["UITEST_PHOTO"] = "1"
    app.launchEnvironment["MOCK_BLOB_API"] = mockAPIURL.appendingPathComponent("blob").absoluteString + "/"
    app.launch()
    signIn(app, code: code)
    return app
  }

  private func waitForLabel(_ element: XCUIElement, containing text: String) -> Bool {
    let found = expectation(for: NSPredicate(format: "label CONTAINS %@", text), evaluatedWith: element)
    return XCTWaiter().wait(for: [found], timeout: 10) == .completed
  }

  private func attachScreenshot(_ app: XCUIApplication, _ name: String) {
    let shot = XCTAttachment(screenshot: app.screenshot())
    shot.name = name
    shot.lifetime = .keepAlways
    add(shot)
  }
}
