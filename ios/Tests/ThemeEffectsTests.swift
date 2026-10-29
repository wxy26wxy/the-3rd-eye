import XCTest
@testable import MakerStory

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
}
