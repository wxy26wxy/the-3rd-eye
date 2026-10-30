import XCTest

/// My designs against scripts/mock_api.py: d1 in the shop, d2 a draft with a sticker listing,
/// d3 failed, d4 still cutting. Each sign-in restores that list.
final class DesignsUITests: XCTestCase {
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

  func testTilesShowTheirStatus() {
    let app = openDesigns()
    XCTAssertTrue(app.buttons["Blue bird on a branch, In the shop"].waitForExistence(timeout: 10))
    XCTAssertTrue(app.buttons["Green frog with a gold crown, Draft"].exists)
    XCTAssertTrue(app.buttons["Red flower, Didn't work"].exists)
    XCTAssertTrue(app.buttons["Yellow sun, Cutting out…"].exists)
  }

  func testOpeningADesignShowsItsActions() {
    let app = openDesigns()
    open(app, "Blue bird on a branch, In the shop")
    for action in ["Make a sticker", "Make a tote", "Edit listing", "Re-do the cutout", "See it in the shop", "Delete"] {
      XCTAssertTrue(app.buttons[action].waitForExistence(timeout: 5), "\(action) is offered")
    }
  }

  func testFailedDesignOffersRedoButNotProducts() {
    let app = openDesigns()
    open(app, "Red flower, Didn't work")
    XCTAssertTrue(app.buttons["Re-do the cutout"].waitForExistence(timeout: 5))
    XCTAssertTrue(app.buttons["Delete"].exists)
    XCTAssertFalse(app.buttons["Make a sticker"].exists, "no cutout, so no product yet")
    XCTAssertFalse(app.buttons["Edit listing"].exists)
  }

  /// "Make a sticker" on a draft goes to Listing details with that draft (no new product).
  func testMakeStickerContinuesTheDraft() throws {
    let app = openDesigns()
    open(app, "Green frog with a gold crown, Draft")
    tap(app, "Make a sticker")
    let name = app.textFields["Name"]
    XCTAssertTrue(name.waitForExistence(timeout: 10), "Listing details is shown")
    XCTAssertEqual(name.value as? String, "Frog King Sticker", "the draft's listing title is filled in")
    XCTAssertTrue(app.tabBars.buttons["Create"].isSelected, "the Create tab took over")
    XCTAssertTrue(try lastBody("products").isEmpty, "the draft product is reused")
  }

  func testDeleteRemovesTheTile() throws {
    let app = openDesigns()
    open(app, "Red flower, Didn't work")
    tap(app, "Delete")
    let confirm = app.buttons["Delete design"]
    XCTAssertTrue(confirm.waitForExistence(timeout: 5), "asks first")
    confirm.tap()
    XCTAssertTrue(app.buttons["Blue bird on a branch, In the shop"].waitForExistence(timeout: 10), "back on the grid")
    XCTAssertFalse(app.buttons["Red flower, Didn't work"].exists, "the tile is gone")
    XCTAssertEqual(try lastBody("delete")["id"] as? String, "d3")
  }

  func testEditListingSendsTheEdits() throws {
    let app = openDesigns()
    open(app, "Blue bird on a branch, In the shop")
    tap(app, "Edit listing")
    let name = app.textFields["Name"]
    XCTAssertTrue(name.waitForExistence(timeout: 5))
    XCTAssertEqual(name.value as? String, "Blue Bird Sticker")
    name.tap()
    name.typeText(" Deluxe")
    let price = app.textFields["Price in dollars"]
    price.tap()
    price.typeText("7.50")
    tap(app, "Save changes")
    XCTAssertTrue(app.buttons["Edit listing"].waitForExistence(timeout: 10), "the sheet closes")
    let body = try lastBody("approve")
    XCTAssertEqual(body["productId"] as? String, "pr-d1")
    let edits = try XCTUnwrap(body["edits"] as? [String: Any])
    XCTAssertEqual(edits["title"] as? String, "Blue Bird Sticker Deluxe")
    XCTAssertEqual(edits["priceCents"] as? Int, 750)
    XCTAssertNil(edits["description"], "an empty description keeps the old one")
  }

  /// Re-do the cutout opens Adjust cutout on the saved photo; "Use this" saves and comes back.
  func testRedoCutoutReturnsToTheDesign() throws {
    let app = openDesigns()
    open(app, "Red flower, Didn't work")
    tap(app, "Re-do the cutout")
    let piece = app.buttons["Piece 1"]
    XCTAssertTrue(piece.waitForExistence(timeout: 10), "Adjust cutout shows the saved photo's pieces")
    XCTAssertFalse(app.buttons["Retake"].exists, "a redo has no Retake")
    piece.tap()
    tap(app, "Use this")
    XCTAssertTrue(app.buttons["Re-do the cutout"].waitForExistence(timeout: 10), "back on the design")
    XCTAssertEqual(try lastBody("cleanup")["candidateIds"] as? [String], ["cand-1"], "one piece is sent as cleanup")
    XCTAssertTrue(app.buttons["Make a sticker"].waitForExistence(timeout: 5), "the new cutout can be made into products")
  }

  // MARK: Helpers

  private func openDesigns() -> XCUIApplication {
    let app = XCUIApplication()
    self.app = app
    app.launch()
    signIn(app, code: "TEST-CODE")
    let tab = app.tabBars.buttons["My designs"]
    XCTAssertTrue(tab.waitForExistence(timeout: 10))
    tab.tap()
    return app
  }

  private func open(_ app: XCUIApplication, _ tile: String) {
    // The context menu makes the tile appear twice in the query; either one opens it.
    let button = app.buttons[tile].firstMatch
    XCTAssertTrue(button.waitForExistence(timeout: 10), "\(tile) is on the grid")
    if !button.isHittable { app.swipeUp() }
    button.tap()
  }

  private func tap(_ app: XCUIApplication, _ label: String) {
    let button = app.buttons[label]
    XCTAssertTrue(button.waitForExistence(timeout: 5), "\(label) exists")
    for _ in 0..<3 where !button.isHittable { app.swipeUp() }
    button.tap()
  }
}
