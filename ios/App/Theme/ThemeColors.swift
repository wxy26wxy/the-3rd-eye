import SwiftUI

/// Semantic colors resolved for the current contrast preference.
struct ThemeColors {
  var bg: Color
  var surface: Color
  var surfaceAlt: Color
  var text: Color
  var textOnDark: Color
  var textMuted: Color
  var accent: Color
  var accentInk: Color
  var primary: Color
  var primaryText: Color
  var primaryShadow: Color
  var border: Color
  var selected: Color
  var danger: Color
  var focusRing: Color
  var showsGrain: Bool

  static let standard = ThemeColors(
    bg: Tokens.Semantic.bg,
    surface: Tokens.Semantic.surface,
    surfaceAlt: Tokens.Semantic.surfaceAlt,
    text: Tokens.Semantic.text,
    textOnDark: Tokens.Semantic.textOnDark,
    textMuted: Tokens.Semantic.textMuted,
    accent: Tokens.Semantic.accent,
    accentInk: Tokens.Semantic.accentInk,
    primary: Tokens.Semantic.primary,
    primaryText: Tokens.Semantic.primaryText,
    primaryShadow: Tokens.Semantic.primaryShadow,
    border: Tokens.Semantic.border,
    selected: Tokens.Semantic.selected,
    danger: Tokens.Semantic.danger,
    focusRing: Tokens.Semantic.focusRing,
    showsGrain: true
  )

  /// tokens.json `highContrast`; roles it does not list map to its text/border.
  static let highContrast = ThemeColors(
    bg: Tokens.HighContrast.bg,
    surface: Tokens.HighContrast.surface,
    surfaceAlt: Tokens.HighContrast.surface,
    text: Tokens.HighContrast.text,
    textOnDark: Tokens.HighContrast.text,
    textMuted: Tokens.HighContrast.text,
    accent: Tokens.HighContrast.accent,
    accentInk: Tokens.HighContrast.text,
    primary: Tokens.HighContrast.primary,
    primaryText: Tokens.HighContrast.primaryText,
    primaryShadow: Tokens.HighContrast.border,
    border: Tokens.HighContrast.border,
    selected: Tokens.HighContrast.accent,
    danger: Tokens.Semantic.danger,
    focusRing: Tokens.HighContrast.border,
    showsGrain: false
  )
}

private struct ThemeColorsKey: EnvironmentKey {
  static let defaultValue = ThemeColors.standard
}

extension EnvironmentValues {
  var themeColors: ThemeColors {
    get { self[ThemeColorsKey.self] }
    set { self[ThemeColorsKey.self] = newValue }
  }
}
