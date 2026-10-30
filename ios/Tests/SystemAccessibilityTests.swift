import SwiftUI
import XCTest
@testable import MakerStory

/// iOS takes contrast from the system setting and shows image descriptions as text (T081).
final class SystemAccessibilityTests: XCTestCase {
  func testIncreasedContrastSelectsHighContrastPalette() {
    let high = ThemeColors.resolved(for: .increased)
    XCTAssertEqual(high.bg, ThemeColors.highContrast.bg)
    XCTAssertEqual(high.text, ThemeColors.highContrast.text)
    XCTAssertEqual(high.primary, ThemeColors.highContrast.primary)
    XCTAssertFalse(high.showsGrain)
  }

  func testStandardContrastSelectsStandardPalette() {
    let standard = ThemeColors.resolved(for: .standard)
    XCTAssertEqual(standard.bg, ThemeColors.standard.bg)
    XCTAssertEqual(standard.text, ThemeColors.standard.text)
    XCTAssertTrue(standard.showsGrain)
  }

  private func artwork(_ fields: String) throws -> Artwork {
    try JSONDecoder().decode(Artwork.self, from: Data(#"{"id":"a1"\#(fields)}"#.utf8))
  }

  @MainActor
  func testDescriptionCardPrefersSpokenDescriptionThenAltText() throws {
    XCTAssertEqual(VoiceResultView.description(of: try artwork(#","altText":"Frog","spokenDescription":"A smiling frog.""#)), "A smiling frog.")
    XCTAssertEqual(VoiceResultView.description(of: try artwork(#","altText":"Frog","spokenDescription":"  ""#)), "Frog")
    XCTAssertNil(VoiceResultView.description(of: try artwork("")))
  }
}
