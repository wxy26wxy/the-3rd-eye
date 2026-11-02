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
    let keep = app.buttons["Looks good as is"]
    XCTAssertTrue(keep.waitForExistence(timeout: 20))
    for _ in 0..<3 where !keep.isHittable { app.swipeUp() }
    keep.tap()

    let drafting = app.descendants(matching: .any)["listing-drafting"]
    XCTAssertTrue(drafting.waitForExistence(timeout: 20), "the drafting card")
    XCTAssertFalse(app.textFields["Name"].exists, "no fields while the listing is written")
    XCTAssertFalse(app.textFields["Price in dollars"].exists)
    XCTAssertFalse(app.buttons["Approve and list it"].isEnabled, "nothing to approve yet")
    attachScreenshot(app, "listing-drafting")

    let name = app.textFields["Name"]
    XCTAssertTrue(name.waitForExistence(timeout: 10), "the fields appear when the run returns")
    XCTAssertFalse((name.value as? String ?? "").isEmpty, "filled by the listing agent")
    XCTAssertFalse(drafting.exists)
    XCTAssertTrue(app.buttons["Approve and list it"].isEnabled)
    XCTAssertTrue(app.descendants(matching: .any)["listing-picture"].exists, "the product picture is shown")
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
    XCTAssertTrue(app.descendants(matching: .any)["story-player"].exists, "the player")
    let setting = app.descendants(matching: .any)["story-disability"]
    XCTAssertTrue(setting.exists)
    XCTAssertTrue(setting.label.contains("Off"), "the disability setting is shown")
    attachScreenshot(app, "my-story-video")
    app.buttons["Record again"].tap()
    XCTAssertTrue(app.staticTexts["Record your story again"].waitForExistence(timeout: 5), "Story video, redo mode")
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
