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
  /// font.display.weightOnPhoto (Inter Bold for titles on the Welcome photo).
  static let displayWeightOnPhoto: Int = 700
  /// Primary action insets: 28 pt before the label, 4 pt around the arrow circle (56 − 48) / 2.
  static let ctaLeading: CGFloat = 28
  static let ctaInset: CGFloat = (Tokens.Size.cta - Tokens.Size.ctaArrow) / 2
  /// Light-green circle behind a method icon: `accent` at this opacity (the board's `#E4F3C8`,
  /// an open question in docs/design/tokens.md, proposal `color.accentSoft`).
  static let iconTileOpacity: Double = 0.25
  /// With Increase Contrast, the panel behind white text on a photo is ink at this opacity
  /// (white on it ≥ 7:1 whatever the photo; the standard `color.scrim` is 35 % black).
  static let highContrastScrimOpacity: Double = 0.8
  /// Still mascot on the sky card: the "Mascot / Front" slot on You're live (153.85 × 181).
  static let stillMascot = CGSize(width: 154, height: 181)
  /// Pressed buttons dim slightly (Sky has no hard shadow to press into).
  static let pressedOpacity: Double = 0.8
  /// Glyph inside the primary action's arrow circle (`Icon / arrow`, 18 in a 48 circle).
  static let ctaGlyph: CGFloat = 18
  /// Glyph inside icon buttons and Back (`Icon / chevron-left`, 22 in a 44 circle).
  static let iconGlyph: CGFloat = 22
  /// Custom tab bar (Figma `Tab bar`): 56 pt tabs, a 56 × 30 accent pill behind a 22 pt icon,
  /// a 20 pt ink badge, 6 pt top padding.
  static let tabHeight: CGFloat = Tokens.Size.cta
  static let tabPill = CGSize(width: Tokens.Size.cta, height: 30)
  static let tabIcon: CGFloat = 22
  static let tabBadge: CGFloat = 20
  static let tabTopPadding: CGFloat = Tokens.Space.xs
  /// Sky card on the loading screen (Figma `Sky card`; the `sky` slot on You're live is 342 × 286).
  static let skyCardAspect: CGFloat = 342.0 / 286.0
  /// Mic glyph inside the 84 pt record button (Figma `Record button`).
  static let recordGlyph: CGFloat = 30
  /// Pick sticker or tote (`45:700`): two product cards 302 pt tall; the sticker mascot's slot
  /// (103 × 147) and the tote photo's slot (130 × 173).
  static let productCardHeight: CGFloat = 302
  static let productSticker = CGSize(width: 103, height: 147)
  static let productTote = CGSize(width: 130, height: 173)
  /// Finding your drawings (`21:4390`): the sky card is 342 × 415.
  static let tallSkyCardAspect: CGFloat = 342.0 / 415.0
  /// Your sticker is ready (`21:4509`): the sticker in the middle is 180 × 257.
  static let readySticker = CGSize(width: 180, height: 257)
  /// You're live (`21:4554`): the listed sticker card (112 × 156, 28 radius, turned 9°) on the sky card.
  static let liveSticker = CGSize(width: 112, height: 156)
  static let liveStickerTilt: Double = 9
  /// Adjust cutout: piece chip thumbnails (80), the check badge on a selected piece on the photo (28),
  /// dimmed art of a piece that is not picked (45 %), tool segments 64 tall.
  static let pieceThumb: CGFloat = 80
  static let photoCheck: CGFloat = 28
  static let unselectedPieceOpacity: Double = 0.45
  static let segmentHeight: CGFloat = 64
  /// Photo card (Figma `Photo card`): the photo sits on the green card with this inset.
  static let photoCardInset: CGFloat = 20
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
