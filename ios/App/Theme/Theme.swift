import SwiftUI

/// The only door from screens into the design tokens.
///
/// Screens and components read sizes through `Theme.*` aliases, colors through
/// `@Environment(\.themeColors)`, and type through `.themeFont(_:)`.
/// Every value comes from `Tokens` (generated from design/tokens.json).
enum Theme {
  typealias Space = Tokens.Space
  typealias Radius = Tokens.Radius
  typealias Border = Tokens.Border
  typealias Size = Tokens.Size
  typealias Shadow = Tokens.Shadow
  typealias Palette = Tokens.Palette
  typealias Opacity = Tokens.Opacity

  static let displayTilt = Angle.degrees(Tokens.displayTilt)
  static let grainOpacity = Tokens.grainOpacity

  /// `size.photoMaxHeight` (65vh on the web): the tallest a photo being edited is shown, as a
  /// share of the screen height. No cap when no window scene is known.
  @MainActor static var photoMaxHeight: CGFloat {
    let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
    guard let height = scene?.screen.bounds.height else { return .infinity }
    return height * Tokens.Size.photoMaxHeightShare
  }
}

/// Values in design/tokens.json `effects` and `motion` that the generator does
/// not emit into Tokens.swift yet. Kept here, inside the Theme layer, so screens
/// never see a literal. Where Tokens.swift has the value it is read from there;
/// the rest is checked against design/tokens.json by ThemeEffectsTests, so a token
/// change fails the build's tests instead of drifting.
enum ThemeEffects {
  /// effects.displayStroke (0 = off since the Sky tokens, T100)
  static let displayStrokeWidth: CGFloat = 0
  static let displayShadowY: CGFloat = 0
  /// effects.scallop (height 0 = off since the Sky tokens, T100)
  static let scallopAmplitude: CGFloat = 16
  static let scallopPeriod: CGFloat = 48.75
  static let scallopHeight: CGFloat = 0
  /// motion (milliseconds in tokens.json)
  static let motionFast: Double = 120 / 1000
  static let motionBase: Double = 200 / 1000
  static let motionSlow: Double = 320 / 1000
  /// Size of the generated noise tile for GrainOverlay.
  static let grainTile: Int = 96
  /// Pressed-state travel for buttons with hard shadows (matches shadow depth).
  static let pressTravel: CGFloat = Tokens.Shadow.hard.y
  /// Thumbnails in lists and grids.
  static let thumbnail: CGFloat = Tokens.Size.methodIcon
  /// Minimum cell width in the My designs grid.
  static let gridMinimum: CGFloat = Tokens.Size.record * 1.7
  /// Mockup height on the order screen.
  static let mockupMaxHeight: CGFloat = Tokens.Size.record * 2.5
  /// Unread-count badge diameter.
  static let badgeSize: CGFloat = Tokens.Size.stepDot * 3
  /// Large artwork previews (relative to screen width in layouts that need it).
  static let artworkMaxHeight: CGFloat = Tokens.Size.record * 4
  /// Tint inside a selected candidate box on the photo.
  static let selectionFillOpacity: Double = 0.35
  /// Checkerboard squares behind a cut-out preview: `border` at this opacity on `surface`
  /// (visible in high contrast too, where surface and surfaceAlt are the same).
  static let checkerOpacity: Double = 0.12
  /// Story video recording limit in seconds.
  static let storyVideoSeconds: Double = 30
  /// Thank-you video recording limit in seconds.
  static let thankYouVideoSeconds: Double = 15
}

/// Shared animation that honours Reduce Motion.
extension Animation {
  static func theme(_ reduceMotion: Bool) -> Animation? {
    reduceMotion ? nil : .timingCurve(0.2, 0.8, 0.2, 1, duration: ThemeEffects.motionBase)
  }
}
