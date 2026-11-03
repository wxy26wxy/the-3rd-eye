import XCTest

/// The Sky tab bar (T103) keeps the system tab bar's contract: one tab bar, four tab buttons that are
/// its direct children (no image or text children of their own), the selected state following taps,
/// and re-tapping the selected tab going back to its first screen. Fails loudly if an iOS update
/// breaks the `UITabBar` host.
final class TabBarUITests: XCTestCase {
  private var app: XCUIApplication?

  override func setUp() {
    continueAfterFailure = false
  }

  override func tearDown() {
    if let app, app.state == .runningForeground, !app.buttons["Start creating"].exists { signOut(app) }
    app = nil
    super.tearDown()
  }

  func testTabBarExposesFourTabsWithSelectedState() {
    let app = XCUIApplication()
    self.app = app
    app.launch()
    signIn(app, code: "TEST-CODE")
    let bar = app.tabBars.firstMatch
    XCTAssertTrue(bar.waitToAppear(timeout: 10))
    XCTAssertEqual(app.tabBars.count, 1)

    let names = ["Create", "My designs", "Orders", "Messages"]
    let buttons = bar.children(matching: .button)
    XCTAssertEqual(buttons.count, 4, "four tabs, direct children of the tab bar")
    XCTAssertEqual((0..<buttons.count).map { buttons.element(boundBy: $0).label }, names)
    for name in names {
      XCTAssertEqual(bar.buttons[name].images.count, 0, "\(name): its icon is not a separate element")
    }
    XCTAssertTrue(bar.buttons["Create"].isSelected)

    for name in names.dropFirst() + ["Create"] {
      bar.buttons[name].tap()
      XCTAssertTrue(bar.buttons[name].waitForSelected(), "\(name) is selected after a tap")
      XCTAssertEqual(names.filter { bar.buttons[$0].isSelected }, [name], "only one tab is selected")
    }

    // Re-tapping the selected tab goes back to its first screen.
    let sticker = app.buttons["Sticker, Die-cut, waterproof"]
    XCTAssertTrue(sticker.waitToAppear(timeout: 5))
    sticker.tap()
    XCTAssertTrue(app.buttons["Back"].waitToAppear(timeout: 5))
    bar.buttons["Create"].tap()
    XCTAssertTrue(sticker.waitToAppear(timeout: 5), "back on the first Create screen")
  }
}

private extension XCUIElement {
  func waitForSelected(timeout: TimeInterval = 5) -> Bool {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if isSelected { return true }
      Thread.sleep(forTimeInterval: 0.2)
    }
    return isSelected
  }
}
