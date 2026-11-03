import XCTest

/// My designs against scripts/mock_api.py: d1 in the shop, d2 a draft with a sticker listing,
/// d3 failed, d4 still cutting, d5 a tote without a known price, d6 a sticker in the shop plus a
/// sticker draft. Each sign-in restores that list.
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
    XCTAssertTrue(app.buttons["Blue bird on a branch, In the shop"].waitToAppear(timeout: 10))
    XCTAssertTrue(app.buttons["Green frog with a gold crown, Draft"].exists)
    XCTAssertTrue(app.buttons["Red flower, Didn't work"].exists)
    XCTAssertTrue(app.buttons["Yellow sun, Cutting out…"].exists)
    let bird = app.buttons.matching(NSPredicate(format: "label == %@", "Blue bird on a branch, In the shop"))
    XCTAssertEqual(bird.count, 1, "each tile is one accessibility element")
  }

  func testOpeningADesignShowsItsActions() {
    let app = openDesigns()
    open(app, "Blue bird on a branch, In the shop")
    for action in ["See it in the shop", "Edit listing", "Make another sticker", "Make a tote", "Re-do the cutout", "Delete"] {
      XCTAssertTrue(app.buttons[action].waitToAppear(timeout: 5), "\(action) is offered")
    }
    XCTAssertFalse(app.buttons["Make a sticker"].exists, "a sticker is already in the shop")
  }

  /// With a sticker in the shop, a second one is made only after a confirmation.
  func testMakeAnotherStickerAsksFirst() throws {
    let app = openDesigns()
    open(app, "Blue bird on a branch, In the shop")
    tap(app, "Make another sticker")
    let confirm = app.sheets.buttons["Make another sticker"].exists ? app.sheets.buttons["Make another sticker"]
      : app.buttons.matching(identifier: "Make another sticker").element(boundBy: 1)
    XCTAssertTrue(confirm.waitToAppear(timeout: 5), "asks first")
    XCTAssertTrue(try lastBody("products").isEmpty, "nothing made before the confirmation")
    confirm.tap()
    // Ruling 2: no sticker draft, so Change it makes the sticker and shows its photo.
    XCTAssertTrue(productPhoto(app).waitToAppear(timeout: 15), "Change it with the new sticker")
    XCTAssertEqual(try lastBody("products")["type"] as? String, "sticker")
    XCTAssertEqual(try lastBody("products")["artworkId"] as? String, "d1")
    let keep = app.buttons["Looks good as is"]
    for _ in 0..<3 where !keep.isHittable { app.swipeUp() }
    waitUntilEnabled(keep)
    keep.tap()
    XCTAssertTrue(app.textFields["Name"].waitToAppear(timeout: 15), "Listing details")
    XCTAssertEqual(try count("products"), 1)
  }

  /// "Edit listing" on a draft goes through Listing details (the normal way to publish).
  func testEditListingOnADraftOpensListingDetails() {
    let app = openDesigns()
    open(app, "Green frog with a gold crown, Draft")
    tap(app, "Edit listing")
    let name = app.textFields["Name"]
    XCTAssertTrue(name.waitToAppear(timeout: 10))
    XCTAssertEqual(name.value as? String, "Frog King Sticker")
    XCTAssertTrue(app.buttons["Approve and list it"].waitToAppear(timeout: 5), "the normal publish button")
    XCTAssertFalse(app.buttons["Save changes"].exists, "not the sheet")
  }

  /// A product summary without the live price (older server): the price must be typed.
  func testEditListingWithoutKnownPriceNeedsOne() throws {
    let app = openDesigns()
    open(app, "Purple cat, In the shop")
    tap(app, "Edit listing")
    let price = app.textFields["Price in dollars"]
    XCTAssertTrue(price.waitToAppear(timeout: 5))
    tap(app, "Save changes")
    let hint = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "Enter a price between")).firstMatch
    XCTAssertTrue(hint.waitToAppear(timeout: 5), "an empty price is refused")
    XCTAssertTrue(try lastBody("approve").isEmpty, "nothing was sent")
    price.tap()
    price.typeText("12")
    tap(app, "Save changes")
    XCTAssertTrue(app.buttons["Edit listing"].waitToAppear(timeout: 10), "the sheet closes")
    let edits = try XCTUnwrap(try lastBody("approve")["edits"] as? [String: Any])
    XCTAssertEqual(edits["priceCents"] as? Int, 1200)
  }

  func testFailedDesignOffersRedoButNotProducts() {
    let app = openDesigns()
    open(app, "Red flower, Didn't work")
    XCTAssertTrue(app.buttons["Re-do the cutout"].waitToAppear(timeout: 5))
    XCTAssertTrue(app.buttons["Re-do the cutout"].isHittable, "the pinned primary is on screen without scrolling (T104)")
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
    XCTAssertTrue(name.waitToAppear(timeout: 10), "Listing details is shown")
    XCTAssertEqual(name.value as? String, "Frog King Sticker", "the draft's listing title is filled in")
    XCTAssertEqual(app.textFields["Price in dollars"].value as? String, "6.00", "and its price")
    XCTAssertTrue(app.tabBars.buttons["Create"].isSelected, "the Create tab took over")
    XCTAssertTrue(try lastBody("products").isEmpty, "the draft product is reused")
  }

  func testDeleteRemovesTheTile() throws {
    let app = openDesigns()
    open(app, "Red flower, Didn't work")
    tap(app, "Delete")
    let confirm = app.buttons["Delete design"]
    XCTAssertTrue(confirm.waitToAppear(timeout: 5), "asks first")
    confirm.tap()
    XCTAssertTrue(app.buttons["Blue bird on a branch, In the shop"].waitToAppear(timeout: 10), "back on the grid")
    XCTAssertFalse(app.buttons["Red flower, Didn't work"].exists, "the tile is gone")
    XCTAssertEqual(try lastBody("delete")["id"] as? String, "d3")
  }

  func testEditListingSendsTheEdits() throws {
    let app = openDesigns()
    open(app, "Blue bird on a branch, In the shop")
    tap(app, "Edit listing")
    let name = app.textFields["Name"]
    XCTAssertTrue(name.waitToAppear(timeout: 5))
    XCTAssertEqual(name.value as? String, "Blue Bird Sticker")
    XCTAssertEqual(app.textFields["Price in dollars"].value as? String, "8.00", "the live price, not the 5.00 suggestion")
    name.tap()
    name.typeText(" Deluxe")
    tap(app, "Save changes")
    XCTAssertTrue(app.buttons["Edit listing"].waitToAppear(timeout: 10), "the sheet closes")
    let body = try lastBody("approve")
    XCTAssertEqual(body["productId"] as? String, "pr-d1")
    let edits = try XCTUnwrap(body["edits"] as? [String: Any])
    XCTAssertEqual(edits["title"] as? String, "Blue Bird Sticker Deluxe")
    XCTAssertEqual(edits["priceCents"] as? Int, 800, "the live price is sent back unchanged")
    XCTAssertEqual(edits["description"] as? String, "A blue bird singing on a branch.")
  }

  /// Round 4: Re-do the cutout opens Your cutout on the stored crop (no Adjust the area, no
  /// `detect`) with "Take a new photo"; marks + Apply cutout send `cleanup` on the design with the
  /// whole picture as the box; "Use this" comes back to the design.
  func testRedoCutoutReturnsToTheDesign() throws {
    let app = openDesigns()
    open(app, "Red flower, Didn't work")
    tap(app, "Re-do the cutout")
    let photo = app.otherElements["cutout-photo"]
    XCTAssertTrue(photo.waitToAppear(timeout: 10), "Your cutout shows the stored picture for marks")
    XCTAssertFalse(app.otherElements["adjust-area"].exists, "no re-frame")
    XCTAssertTrue(app.buttons["Take a new photo"].exists)
    XCTAssertFalse(app.buttons["Start over"].exists)
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.3)).tap()
    tap(app, "Apply cutout")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitToAppear(timeout: 15))
    let body = try lastBody("cleanup")
    XCTAssertEqual(try lastBody("cleanup-target")["artworkId"] as? String, "d3")
    XCTAssertEqual(body["box"] as? [Double], [0, 0, 1200, 1600], "the whole stored picture")
    XCTAssertEqual(try count("detect"), 0)
    tap(app, "Use this")
    XCTAssertTrue(app.buttons["Re-do the cutout"].waitToAppear(timeout: 10), "back on the design")
    XCTAssertTrue(app.buttons["Make a sticker"].waitToAppear(timeout: 5), "the new cutout can be made into products")
  }

  // MARK: T091

  /// A sticker in the shop and a sticker draft: the button reads "Continue the sticker draft", and
  /// the confirmation says so instead of promising a second listing.
  func testMakeAnotherWithADraftSaysItContinuesTheDraft() throws {
    let app = openDesigns()
    open(app, "Orange fish, In the shop")
    XCTAssertTrue(app.buttons["Continue the sticker draft"].waitToAppear(timeout: 5))
    XCTAssertFalse(app.buttons["Make another sticker"].exists, "the label says what happens")
    tap(app, "Continue the sticker draft")
    let confirm = app.buttons["Yes, continue the draft"]
    XCTAssertTrue(confirm.waitToAppear(timeout: 5), "asks first, naming the draft")
    XCTAssertTrue(text(app, containing: "This continues your sticker draft").exists)
    XCTAssertFalse(text(app, containing: "A second product gets its own listing").exists)
    confirm.tap()
    let name = app.textFields["Name"]
    XCTAssertTrue(name.waitToAppear(timeout: 10), "Listing details")
    XCTAssertEqual(name.value as? String, "Fish Friend Sticker", "the draft, not a new product")
    XCTAssertTrue(try lastBody("products").isEmpty, "no product was made")
  }

  /// "Edit listing" on the draft row goes straight to Listing details, even with a sticker of the
  /// same design in the shop (T091 review minor 1).
  func testEditListingOnADraftNextToAPublishedOneDoesNotAsk() {
    let app = openDesigns()
    open(app, "Orange fish, In the shop")
    XCTAssertTrue(app.buttons["Edit the sticker listing"].waitToAppear(timeout: 5), "the live one keeps its label")
    tap(app, "Edit the sticker draft")
    let name = app.textFields["Name"]
    XCTAssertTrue(name.waitToAppear(timeout: 10), "Listing details, no dialog")
    XCTAssertEqual(name.value as? String, "Fish Friend Sticker")
    XCTAssertFalse(app.buttons["Yes, continue the draft"].exists)
    XCTAssertFalse(text(app, containing: "already in the shop").exists)
  }

  /// Emptying a prefilled description sends "" (an omitted field would keep the saved text).
  func testEmptiedDescriptionIsCleared() throws {
    let app = openDesigns()
    open(app, "Blue bird on a branch, In the shop")
    tap(app, "Edit listing")
    let field = app.textFields["Description"].exists ? app.textFields["Description"] : app.textViews["Description"]
    XCTAssertTrue(field.waitToAppear(timeout: 5))
    let saved = field.value as? String ?? ""
    XCTAssertEqual(saved, "A blue bird singing on a branch.")
    field.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: 0.5)).tap()
    field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: saved.count + 3))
    tap(app, "Save changes")
    XCTAssertTrue(app.buttons["Edit listing"].waitToAppear(timeout: 10), "the sheet closes")
    let edits = try XCTUnwrap(try lastBody("approve")["edits"] as? [String: Any])
    XCTAssertEqual(edits["description"] as? String, "", "sent explicitly as empty")
  }

  /// With a creation in progress in the Create tab, "Make a sticker" asks before replacing it.
  func testContinueAsksBeforeReplacingACreationInProgress() {
    let app = XCUIApplication()
    self.app = app
    app.launch()
    signIn(app, code: "TEST-CODE")
    let sticker = app.buttons["Sticker, Die-cut, waterproof"]
    XCTAssertTrue(sticker.waitToAppear(timeout: 10))
    sticker.tap()
    XCTAssertTrue(app.buttons["Upload a picture, Pick one you already have"].waitToAppear(timeout: 5), "a creation is under way")
    app.tabBars.buttons["My designs"].tap()
    open(app, "Green frog with a gold crown, Draft")
    tap(app, "Make a sticker")
    let replace = app.buttons["Replace it"]
    XCTAssertTrue(replace.waitToAppear(timeout: 5), "asks first")
    XCTAssertTrue(text(app, containing: "You have a design in progress in the Create tab").exists)
    // A popover-style dialog has no Cancel button; tapping outside it cancels.
    if app.buttons["Cancel"].exists { app.buttons["Cancel"].tap() } else { app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.08)).tap() }
    XCTAssertTrue(replace.waitToDisappear(timeout: 2), "the dialog closed")
    XCTAssertTrue(app.buttons["Make a sticker"].waitToAppear(timeout: 5), "Cancel stays on the design")
    XCTAssertFalse(app.textFields["Name"].exists)
    tap(app, "Make a sticker")
    XCTAssertTrue(replace.waitToAppear(timeout: 5))
    replace.tap()
    let name = app.textFields["Name"]
    XCTAssertTrue(name.waitToAppear(timeout: 10), "Listing details replaced the creation")
    XCTAssertEqual(name.value as? String, "Frog King Sticker")
  }

  /// 409 moderation_failed: the app's words, not the server's technical reason; the sheet stays.
  func testModerationRefusalIsExplained() throws {
    let app = openDesigns()
    open(app, "Blue bird on a branch, In the shop")
    tap(app, "Edit listing")
    let name = app.textFields["Name"]
    XCTAssertTrue(name.waitToAppear(timeout: 5))
    name.tap()
    name.typeText(" unkind")
    tap(app, "Save changes")
    XCTAssertTrue(text(app, containing: "Some words in the name or description can't go in the shop.").waitToAppear(timeout: 10))
    XCTAssertFalse(text(app, containing: "flagged").exists, "the server's note is not shown")
    XCTAssertTrue(app.buttons["Save changes"].exists, "the sheet stays open to fix it")
    XCTAssertEqual(try lastBody("approve")["productId"] as? String, "pr-d1")
    tap(app, "Cancel")
    XCTAssertTrue(app.buttons["Edit listing"].waitToAppear(timeout: 5), "closed, so tearDown can sign out")
  }

  /// Round 3 ruling 2: faint colours (mock NOPRINT…: 409 print_check_failed, check contrast) are a
  /// warning: the reason in plain words and "Use anyway", which approves with acceptPrintWarning.
  func testContrastWarningCanBeUsedAnyway() throws {
    let app = openDesigns(code: "NOPRINT-CODE")
    open(app, "Green frog with a gold crown, Draft")
    tap(app, "Edit listing")
    XCTAssertTrue(app.textFields["Name"].waitToAppear(timeout: 10))
    tap(app, "Approve and list it")
    XCTAssertTrue(text(app, containing: "it may look faint when printed").waitToAppear(timeout: 10))
    XCTAssertFalse(text(app, containing: "chroma").exists, "the server's note is not shown")
    XCTAssertNil(try lastBody("approve")["acceptPrintWarning"])
    tap(app, "Use anyway")
    XCTAssertTrue(text(app, containing: "You're live").waitToAppear(timeout: 15), "listed")
    XCTAssertEqual(try lastBody("approve")["acceptPrintWarning"] as? Bool, true)
  }

  /// A picture too small to print sharply (mock NORES…: check resolution) is refused: no "Use
  /// anyway", the way out is Re-do the cutout.
  func testResolutionRefusalCannotBeUsedAnyway() throws {
    let app = openDesigns(code: "NORES-CODE")
    open(app, "Green frog with a gold crown, Draft")
    tap(app, "Edit listing")
    XCTAssertTrue(app.textFields["Name"].waitToAppear(timeout: 10))
    tap(app, "Approve and list it")
    XCTAssertTrue(text(app, containing: "too small to print sharply").waitToAppear(timeout: 10))
    XCTAssertFalse(app.buttons["Use anyway"].exists, "a resolution failure cannot be accepted")
    XCTAssertTrue(app.buttons["Approve and list it"].exists, "still on Listing details")
    // Round 4: no local photo for a saved design, so Your cutout on the stored crop with "Take a new photo".
    tap(app, "Re-do the cutout")
    XCTAssertTrue(app.staticTexts["Your cutout is ready. Here it is."].waitToAppear(timeout: 10), "Your cutout of the design")
    XCTAssertTrue(app.buttons["Take a new photo"].exists)
    XCTAssertFalse(app.otherElements["adjust-area"].exists)
  }

  // MARK: Helpers

  /// Ruling 3 (T144): back from a design the tiles show at once (pictures from the memory cache,
  /// no spinner) and the list is not fetched again within 30 s.
  func testBackFromADesignShowsTheTilesAtOnce() throws {
    let app = openDesigns()
    let bird = app.buttons["Blue bird on a branch, In the shop"]
    XCTAssertTrue(bird.waitToAppear(timeout: 10))
    let loading = app.descendants(matching: .any).matching(identifier: "tile-loading")
    XCTAssertTrue(poll(timeout: 10) { loading.count == 0 }, "every tile drew its picture")
    let fetched = try count("artworks")
    XCTAssertGreaterThanOrEqual(fetched, 1)
    open(app, "Blue bird on a branch, In the shop")
    XCTAssertTrue(app.buttons["See it in the shop"].waitToAppear(timeout: 5))
    app.buttons["Back"].firstMatch.tap()
    XCTAssertTrue(bird.waitToAppear(timeout: 5))
    XCTAssertEqual(loading.count, 0, "every tile drew its picture from the cache")
    XCTAssertEqual(try count("artworks"), fetched, "the list was not fetched again")
  }

  private func openDesigns(code: String = "TEST-CODE") -> XCUIApplication {
    let app = XCUIApplication()
    self.app = app
    app.launch()
    signIn(app, code: code)
    let tab = app.tabBars.buttons["My designs"]
    XCTAssertTrue(tab.waitToAppear(timeout: 10))
    tab.tap()
    return app
  }

  private func open(_ app: XCUIApplication, _ tile: String) {
    let button = app.buttons[tile]
    XCTAssertTrue(button.waitToAppear(timeout: 10), "\(tile) is on the grid")
    if !button.isHittable { app.swipeUp() }
    button.tap()
  }

  private func text(_ app: XCUIApplication, containing words: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", words)).firstMatch
  }

  private func tap(_ app: XCUIApplication, _ label: String) {
    let button = app.buttons[label]
    XCTAssertTrue(button.waitToAppear(timeout: 5), "\(label) exists")
    for _ in 0..<3 where !button.isHittable { app.swipeUp() }
    button.tap()
  }
}
