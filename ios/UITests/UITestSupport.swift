import XCTest

/// This test runner's session on the shared mock (T145): parallel runners, one per simulator clone,
/// keep apart because the sign-in code ends in `-S<id>` (the mock then answers a token for that
/// session) and the runner's own calls and the app's blob uploads go through `/s/<id>`.
let mockSessionID = String(Int.random(in: 100_000...999_999))

/// Polls `condition` every 0.2 s until it holds or `timeout` passes (T145: XCTest's own waits check
/// once a second, which cost about a second per screen). Returns the last answer.
func poll(timeout: TimeInterval, _ condition: () -> Bool) -> Bool {
  let deadline = Date().addingTimeInterval(timeout)
  while !condition() {
    guard Date() < deadline else { return false }
    Thread.sleep(forTimeInterval: 0.2)
  }
  return true
}

extension XCUIElement {
  /// `waitForExistence(timeout:)`, polled every 0.2 s.
  func waitToAppear(timeout: TimeInterval) -> Bool {
    poll(timeout: timeout) { exists }
  }

  /// `waitForNonExistence(timeout:)`, polled every 0.2 s.
  func waitToDisappear(timeout: TimeInterval) -> Bool {
    poll(timeout: timeout) { !exists }
  }
}

/// Shared steps for the UI tests that run against scripts/mock_api.py.
extension XCTestCase {
  /// Mock server root, from `TEST_RUNNER_MOCK_API_URL` (default http://localhost:3999).
  var mockAPIURL: URL {
    URL(string: ProcessInfo.processInfo.environment["MOCK_API_URL"] ?? "http://localhost:3999")!
  }

  /// This runner's session on the mock: `/__mock/...` reads and the blob store go through it.
  var mockSessionURL: URL {
    mockAPIURL.appendingPathComponent("s").appendingPathComponent(mockSessionID)
  }

  /// The app's blob store (`MOCK_BLOB_API`), in this runner's session.
  var mockBlobAPI: String {
    mockSessionURL.appendingPathComponent("blob").absoluteString + "/"
  }

  /// Signs out if a previous test left the app signed in, then signs in with `code` (the mock's mode;
  /// this runner's session is appended).
  func signIn(_ app: XCUIApplication, code: String) {
    let start = app.buttons["Start creating"]
    // Welcome or, when a test left the app signed in, the tab bar: whichever comes first.
    XCTAssertTrue(poll(timeout: 15) { start.exists || app.tabBars.firstMatch.exists }, "the app opened")
    if !start.exists { signOut(app) }
    start.tap()
    let field = app.textFields["Sign-in code"]
    XCTAssertTrue(field.waitToAppear(timeout: 5))
    field.tap()
    field.typeText("\(code)-S\(mockSessionID)")
    app.buttons["Sign in"].tap()
  }

  /// Signs out from the My designs tab (leaves a later test, such as the deep link one, signed out).
  func signOut(_ app: XCUIApplication) {
    openSignOutDialog(app)
    let confirm = signOutConfirm(app)
    XCTAssertTrue(confirm.waitToAppear(timeout: 5))
    confirm.tap()
    XCTAssertTrue(app.buttons["Start creating"].waitToAppear(timeout: 5))
  }

  /// Taps the header's sign-out button (identifier `sign-out`) on My designs.
  func openSignOutDialog(_ app: XCUIApplication) {
    let button = app.buttons.matching(identifier: "sign-out").firstMatch
    // A tap that lands while the app is still settling (just back from the background) can be lost:
    // tap the tab again rather than wait longer (T145).
    for _ in 0..<3 where !button.exists {
      app.tabBars.buttons["My designs"].tap()
      if button.waitToAppear(timeout: 3) { break }
    }
    XCTAssertTrue(button.exists, "the sign-out button on My designs")
    button.tap()
  }

  /// The dialog's confirm: by its identifier, or, where the system dialog drops identifiers, the
  /// button labelled "Sign out" that is not the header button. Never by position.
  func signOutConfirm(_ app: XCUIApplication) -> XCUIElement {
    // One query for both, so a dialog without identifiers costs no extra wait (T145).
    app.buttons.matching(NSPredicate(format: "identifier == %@ OR (label == %@ AND identifier != %@)",
                                     "sign-out-confirm", "Sign out", "sign-out")).firstMatch
  }

  /// Waits until `element` is enabled (Change it's buttons wait while the product is made).
  func waitUntilEnabled(_ element: XCUIElement, timeout: TimeInterval = 20) {
    XCTAssertTrue(poll(timeout: timeout) { element.exists && element.isEnabled }, "\(element) is enabled")
  }

  /// Change it's product photo (round 4 ruling 2), once it is made.
  func productPhoto(_ app: XCUIApplication) -> XCUIElement {
    app.descendants(matching: .any)["change-product-photo"]
  }

  /// The last body the app sent to a mock route (`GET /__mock/last/<route>`); empty when none.
  func lastBody(_ route: String) throws -> [String: Any] {
    let url = mockSessionURL.appendingPathComponent("__mock/last/\(route)")
    let done = expectation(description: "mock \(route)")
    let received = Received()
    URLSession.shared.dataTask(with: url) { data, _, _ in
      received.data = data
      done.fulfill()
    }.resume()
    wait(for: [done], timeout: 10)
    return try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(received.data)) as? [String: Any])
  }

  /// Calls the app made to a mock route since sign-in (`GET /__mock/count/<route>`).
  func count(_ route: String) throws -> Int {
    let url = mockSessionURL.appendingPathComponent("__mock/count/\(route)")
    let done = expectation(description: "mock count \(route)")
    let received = Received()
    URLSession.shared.dataTask(with: url) { data, _, _ in
      received.data = data
      done.fulfill()
    }.resume()
    wait(for: [done], timeout: 10)
    let json = try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(received.data)) as? [String: Any])
    return try XCTUnwrap(json["count"] as? Int)
  }

  /// Waits until the mock has counted `route` at least `atLeast` times (instead of a fixed sleep
  /// for something only the server sees, such as a dropped answer).
  func waitForCount(_ route: String, atLeast: Int = 1, timeout: TimeInterval = 10) throws {
    let deadline = Date().addingTimeInterval(timeout)
    while try count(route) < atLeast {
      guard Date() < deadline else {
        return XCTFail("the mock counted \(route) fewer than \(atLeast) times in \(Int(timeout)) s")
      }
      Thread.sleep(forTimeInterval: 0.2)
    }
  }
}

/// Written once by the URLSession callback, read after the expectation is fulfilled.
private final class Received: @unchecked Sendable {
  var data: Data?
}
