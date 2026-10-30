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

    let first = app.buttons["Piece 1"].firstMatch
    XCTAssertTrue(first.waitForExistence(timeout: 20), "Adjust cutout shows the pieces")
    XCTAssertFalse(first.isSelected)
    first.tap()
    XCTAssertTrue(app.buttons["Piece 1"].firstMatch.isSelected, "the chip reads as selected")
    app.buttons["Piece 2"].firstMatch.tap()
    XCTAssertTrue(app.buttons["Piece 2"].firstMatch.isSelected)

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

    let photo = app.otherElements["cutout-photo"].firstMatch
    XCTAssertTrue(photo.waitForExistence(timeout: 20))
    app.buttons["Piece 1"].firstMatch.tap()
    XCTAssertTrue(app.buttons["Add area"].firstMatch.isSelected, "Add area is the starting mode")
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    XCTAssertTrue(app.buttons["Added area, mark 1"].firstMatch.waitForExistence(timeout: 3), "the mark is shown")

    let preview = app.buttons["Preview cutout"].firstMatch
    if !preview.isHittable { app.swipeUp() }
    preview.tap()
    let back = app.buttons["Back to photo"].firstMatch
    XCTAssertTrue(back.waitForExistence(timeout: 10), "the preview is shown with a way back")
    XCTAssertTrue(app.otherElements["cutout-preview"].firstMatch.exists)

    let body = try lastBody("cleanup")
    XCTAssertEqual(body["candidateIds"] as? [String], ["cand-1"])
    let point = try XCTUnwrap((body["points"] as? [[String: Any]])?.first)
    XCTAssertEqual(point["label"] as? String, "positive")
    XCTAssertEqual(try XCTUnwrap(point["x"] as? Double), 600, accuracy: 20)
    XCTAssertEqual(try XCTUnwrap(point["y"] as? Double), 800, accuracy: 20)

    back.tap()
    XCTAssertTrue(photo.waitForExistence(timeout: 3), "back to the photo with the marks")
  }

  /// One piece: Finding drawings skips to Design ready, which offers "Adjust cutout".
  func testSinglePieceCanBeAdjustedFromDesignReady() throws {
    let app = launchPhotoFlow(code: "ONE-CODE")

    let adjust = app.buttons["Adjust cutout"].firstMatch
    XCTAssertTrue(adjust.waitForExistence(timeout: 20), "Design ready offers Adjust cutout")
    adjust.tap()
    let piece = app.buttons["Piece 1"].firstMatch
    XCTAssertTrue(piece.waitForExistence(timeout: 5))
    XCTAssertTrue(piece.isSelected, "the piece already used is selected")
    XCTAssertFalse(app.buttons["Retake"].exists, "redo mode has no Retake")
    tapUseThis(app)
    XCTAssertTrue(app.buttons["Adjust cutout"].waitForExistence(timeout: 10), "back on Design ready")
    XCTAssertEqual(try lastBody("select")["candidateId"] as? String, "cand-1")
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
    let use = app.buttons["Use this"].firstMatch
    XCTAssertTrue(use.waitForExistence(timeout: 5))
    if !use.isHittable { app.swipeUp() }
    XCTAssertTrue(use.isEnabled)
    use.tap()
  }

  private func lastBody(_ route: String) throws -> [String: Any] {
    let url = mockAPIURL.appendingPathComponent("__mock/last/\(route)")
    let done = expectation(description: "mock \(route)")
    let received = Received()
    URLSession.shared.dataTask(with: url) { data, _, _ in
      received.data = data
      done.fulfill()
    }.resume()
    wait(for: [done], timeout: 10)
    return try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(received.data)) as? [String: Any])
  }
}

/// Written once by the URLSession callback, read after the expectation is fulfilled.
private final class Received: @unchecked Sendable {
  var data: Data?
}
