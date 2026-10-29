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

  static let displayTilt = Angle.degrees(Tokens.displayTilt)
  static let grainOpacity = Tokens.grainOpacity
}

/// Values in design/tokens.json `effects` and `motion` that the generator does
/// not emit into Tokens.swift yet. Kept here, inside the Theme layer, so screens
/// never see a literal.
enum ThemeEffects {
  /// effects.displayStroke
  static let displayStrokeWidth: CGFloat = 2
  static let displayShadowY: CGFloat = 5
  /// effects.scallop
  static let scallopAmplitude: CGFloat = 16
  static let scallopPeriod: CGFloat = 48.75
  static let scallopHeight: CGFloat = 26
  /// motion (milliseconds in tokens.json)
  static let motionFast: Double = 0.12
  static let motionBase: Double = 0.20
  static let motionSlow: Double = 0.32
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
