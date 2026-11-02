import SwiftUI
import XCTest
@testable import The3rdEye

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
    XCTAssertEqual(try artwork(#","altText":"Frog","spokenDescription":"A smiling frog.""#).shownDescription, "A smiling frog.")
    XCTAssertEqual(try artwork(#","altText":"Frog","spokenDescription":"  ""#).shownDescription, "Frog")
    XCTAssertNil(try artwork("").shownDescription)
  }

  /// T091: the sign-out confirmation keeps version, git sha and server, with or without a name.
  func testSignOutDetailsKeepVersionShaAndServer() {
    XCTAssertEqual(SignOutButton.details(name: "Ana", version: "0.4.0", sha: "86ce0d1", server: "https://example.app"),
                   "Signed in as Ana. Version 0.4.0 (86ce0d1), https://example.app")
    XCTAssertEqual(SignOutButton.details(name: nil, version: "0.4.0", sha: "dev", server: "http://localhost:3999"),
                   "Version 0.4.0 (dev), http://localhost:3999")
  }

  /// T103 fix round 1: text on photos stays light in both palettes, so Increase Contrast never turns
  /// Welcome's white text ink on the dark scrim; with high contrast the scrim gets darker instead.
  func testTextOnDarkStaysLightInBothPalettes() {
    for palette in [ThemeColors.standard, ThemeColors.highContrast] {
      XCTAssertGreaterThan(Self.luminance(palette.textOnDark), 0.9, "textOnDark is light")
    }
    let standardScrim = UIColor(ThemeColors.standard.scrim).cgColor.alpha
    let contrastScrim = UIColor(ThemeColors.highContrast.scrim).cgColor.alpha
    XCTAssertGreaterThan(contrastScrim, standardScrim, "the high-contrast scrim is darker")
  }

  /// Relative luminance (WCAG) of an opaque colour.
  private static func luminance(_ color: Color) -> Double {
    var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
    UIColor(color).getRed(&r, green: &g, blue: &b, alpha: &a)
    func channel(_ c: CGFloat) -> Double {
      let v = Double(c)
      return v <= 0.03928 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }
}
