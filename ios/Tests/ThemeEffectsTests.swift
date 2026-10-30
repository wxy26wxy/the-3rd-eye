import XCTest
@testable import The3rdEye

/// ThemeEffects mirrors design/tokens.json values the token generator does not emit yet.
final class ThemeEffectsTests: XCTestCase {
  private func tokens() throws -> [String: Any] {
    let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    let data = try Data(contentsOf: root.appendingPathComponent("design/tokens.json"))
    return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
  }

  private func number(_ dict: [String: Any], _ path: String...) throws -> Double {
    var node: Any = dict
    for key in path { node = try XCTUnwrap((node as? [String: Any])?[key], "missing \(path.joined(separator: "."))") }
    return try XCTUnwrap((node as? NSNumber)?.doubleValue, path.joined(separator: "."))
  }

  func testEffectsMatchTokens() throws {
    let t = try tokens()
    XCTAssertEqual(Double(ThemeEffects.displayStrokeWidth), try number(t, "effects", "displayStroke", "width"))
    XCTAssertEqual(Double(ThemeEffects.displayShadowY), try number(t, "effects", "displayStroke", "shadowY"))
    XCTAssertEqual(Double(ThemeEffects.scallopAmplitude), try number(t, "effects", "scallop", "amplitude"))
    XCTAssertEqual(Double(ThemeEffects.scallopPeriod), try number(t, "effects", "scallop", "period"))
    XCTAssertEqual(Double(ThemeEffects.scallopHeight), try number(t, "effects", "scallop", "height"))
    XCTAssertEqual(Theme.grainOpacity, try number(t, "effects", "grain", "opacity"))
  }

  func testMotionMatchesTokens() throws {
    let t = try tokens()
    XCTAssertEqual(ThemeEffects.motionFast * 1000, try number(t, "motion", "fast"), accuracy: 0.001)
    XCTAssertEqual(ThemeEffects.motionBase * 1000, try number(t, "motion", "base"), accuracy: 0.001)
    XCTAssertEqual(ThemeEffects.motionSlow * 1000, try number(t, "motion", "slow"), accuracy: 0.001)
  }

  /// Sky (T100): values the generator emits that iOS code depends on.
  func testSkyTokens() throws {
    let t = try tokens()
    XCTAssertEqual(Tokens.displayTilt, 0)
    XCTAssertEqual(Double(Tokens.Size.logoMark.width), try number(t, "size", "logoMark", "w"))
    XCTAssertEqual(Double(Tokens.Size.logoMark.height), try number(t, "size", "logoMark", "h"))
    XCTAssertEqual(Double(Tokens.ShadowBlur.soft), try number(t, "shadow", "soft", "blur"))
  }

  /// Inter-Variable.ttf is bundled and registered (Info.plist UIAppFonts) under the name Tokens.FontName uses.
  func testInterIsRegistered() {
    XCTAssertNotNil(UIFont(name: Tokens.FontName.body, size: 15), "Inter not registered as \(Tokens.FontName.body)")
    XCTAssertNotNil(UIFont(name: Tokens.FontName.display, size: 48))
  }

  /// Every non-pending asset in tokens.json has an imageset in the app bundle (pnpm assets).
  func testAssetsAreBundled() {
    for name in [Tokens.Asset.logoMark, Tokens.Asset.welcomeBg, Tokens.Asset.mascotBook, Tokens.Asset.mascotOutline,
                 Tokens.Asset.tote, Tokens.Asset.iconCamera, Tokens.Asset.iconImage, Tokens.Asset.iconMic,
                 Tokens.Asset.iconChevronRight, Tokens.Asset.iconCheck, Tokens.Asset.iconArrow] {
      XCTAssertNotNil(UIImage(named: name), name)  // tests run hosted in the app, so the main bundle is the app
    }
  }
}
