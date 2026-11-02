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

  /// T091: the Adjust-cutout photo is capped at `size.photoMaxHeight` of the screen.
  @MainActor
  func testPhotoMaxHeightIsAShareOfTheScreen() throws {
    let height = Theme.photoMaxHeight
    try XCTSkipIf(height == .infinity, "no window scene in this test host")
    let screen = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first).screen.bounds.height
    XCTAssertEqual(height, screen * Tokens.Size.photoMaxHeightShare, accuracy: 0.5)
    XCTAssertLessThan(Theme.Opacity.disabled, 1)
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

  /// Every non-pending asset in tokens.json is in the app bundle (pnpm assets): an imageset, or for a GIF
  /// its MP4 in Resources/Animations. Tests run hosted in the app, so the main bundle is the app.
  func testAssetsAreBundled() throws {
    let assets = try XCTUnwrap(try tokens()["assets"] as? [String: [String: Any]])
    XCTAssertFalse(assets.isEmpty)
    for (key, entry) in assets where (entry["pending"] as? Bool) != true {
      let file = try XCTUnwrap(entry["file"] as? String, key)
      let name = (file as NSString).deletingPathExtension
      if (file as NSString).pathExtension.lowercased() == "gif" {
        XCTAssertNotNil(Bundle.main.url(forResource: name, withExtension: "mp4"), "\(key): \(name).mp4")
      } else {
        XCTAssertNotNil(UIImage(named: name), "\(key): \(name)")
      }
    }
  }

  /// ThemeFont weights follow type.<role>.weight in tokens.json.
  func testTypeWeightsMatchTokens() throws {
    let t = try tokens()
    let roles: [(TextRole, String)] = [(.displayXL, "displayXL"), (.displayL, "displayL"), (.displayM, "displayM"),
                                       (.titleL, "titleL"), (.titleM, "titleM"), (.bodyL, "bodyL"), (.body, "body"),
                                       (.bodyS, "bodyS"), (.caption, "caption"), (.eyebrow, "eyebrow")]
    for (role, key) in roles {
      let css = Int(try number(t, "type", key, "weight"))
      XCTAssertEqual(role.weight, TextRole.fontWeight(css), key)
    }
  }

  /// T103: line heights mirrored in TextRole and the display weight on photos follow tokens.json.
  func testLineHeightsAndPhotoWeightMatchTokens() throws {
    let t = try tokens()
    let roles: [(TextRole, String)] = [(.displayXL, "displayXL"), (.displayL, "displayL"), (.displayM, "displayM"),
                                       (.titleL, "titleL"), (.titleM, "titleM"), (.bodyL, "bodyL"), (.body, "body"),
                                       (.bodyS, "bodyS"), (.caption, "caption"), (.eyebrow, "eyebrow")]
    for (role, key) in roles {
      let entry = try XCTUnwrap((t["type"] as? [String: Any])?[key] as? [String: Any], key)
      let expected = (entry["lineHeight"] as? NSNumber)?.doubleValue
      XCTAssertEqual(role.lineHeight.map(Double.init), expected, key)
    }
    XCTAssertEqual(Double(ThemeEffects.displayWeightOnPhoto), try number(t, "font", "display", "weightOnPhoto"))
    XCTAssertEqual(ThemeEffects.ctaInset, (Tokens.Size.cta - Tokens.Size.ctaArrow) / 2)
  }

  /// T103: the retired effects draw nothing and the step pill is only a VoiceOver hint.
  func testRetiredEffectsAreOff() {
    XCTAssertEqual(Theme.grainOpacity, 0)
    XCTAssertEqual(ThemeEffects.scallopHeight, 0)
    XCTAssertEqual(ThemeEffects.displayStrokeWidth, 0)
    XCTAssertEqual(Tokens.Shadow.hard.y, 0)
    XCTAssertEqual(Tokens.Shadow.primary.y, 0)
  }

  /// T103: the mascot poses and the loading animation resolve to bundled assets.
  func testMascotAssetsResolve() {
    XCTAssertNotNil(UIImage(named: Tokens.Asset.mascotBook))
    XCTAssertNotNil(UIImage(named: Tokens.Asset.mascotFront))
    XCTAssertNotNil(UIImage(named: Tokens.Asset.sky))
    XCTAssertNotNil(UIImage(named: Tokens.Asset.logoMark))
    XCTAssertNotNil(Bundle.main.url(forResource: Tokens.Asset.mascotMagnifier, withExtension: "mp4"))
  }

  /// Outfit's variable TTF defaults to Thin (100): every role must ask for Regular (400) or heavier.
  func testEveryTextRoleIsAtLeastRegular() {
    for role in TextRole.allCases {
      XCTAssertGreaterThanOrEqual(role.cssWeight, 400, "\(role) would draw thinner than Regular")
      XCTAssertNotEqual(role.weight, .light, "\(role)")
      XCTAssertNotEqual(role.weight, .thin, "\(role)")
      XCTAssertNotEqual(role.weight, .ultraLight, "\(role)")
    }
    XCTAssertEqual(TextRole.body.weight, .regular, "the app-wide default font (The3rdEyeApp) is body, Regular")
  }
}

