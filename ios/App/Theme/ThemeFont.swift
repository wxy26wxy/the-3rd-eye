import SwiftUI
import UIKit

/// Type roles from tokens.json `type`. Custom fonts scale with Dynamic Type
/// through `relativeTo:`.
enum TextRole {
  case displayXL, displayL, displayM, titleL, titleM, bodyL, body, bodyS, caption, eyebrow, step

  var size: CGFloat {
    switch self {
    case .displayXL: return Tokens.TypeScale.displayXL
    case .displayL: return Tokens.TypeScale.displayL
    case .displayM: return Tokens.TypeScale.displayM
    case .titleL: return Tokens.TypeScale.titleL
    case .titleM: return Tokens.TypeScale.titleM
    case .bodyL: return Tokens.TypeScale.bodyL
    case .body: return Tokens.TypeScale.body
    case .bodyS: return Tokens.TypeScale.bodyS
    case .caption: return Tokens.TypeScale.caption
    case .eyebrow: return Tokens.TypeScale.eyebrow
    // tokens.json has no `step` role since the Sky tokens (T100): no step pill on the boards.
    case .step: return Tokens.TypeScale.eyebrow
    }
  }

  var textStyle: Font.TextStyle {
    switch self {
    case .displayXL, .displayL: return .largeTitle
    case .displayM: return .title
    case .titleL: return .title2
    case .titleM: return .title3
    case .bodyL, .body: return .body
    case .bodyS: return .callout
    case .caption: return .footnote
    case .eyebrow, .step: return .caption
    }
  }

  var isDisplay: Bool {
    switch self {
    case .displayXL, .displayL, .displayM: return true
    default: return false
    }
  }

  /// Outfit weight for the role: `type.<role>.weight` in tokens.json (Tokens.TypeWeight), on the variable font axis.
  var weight: Font.Weight {
    switch self {
    case .displayXL: return Self.fontWeight(Tokens.TypeWeight.displayXL)
    case .displayL: return Self.fontWeight(Tokens.TypeWeight.displayL)
    case .displayM: return Self.fontWeight(Tokens.TypeWeight.displayM)
    case .titleL: return Self.fontWeight(Tokens.TypeWeight.titleL)
    case .titleM: return Self.fontWeight(Tokens.TypeWeight.titleM)
    case .bodyL: return Self.fontWeight(Tokens.TypeWeight.bodyL)
    case .body: return Self.fontWeight(Tokens.TypeWeight.body)
    case .bodyS: return Self.fontWeight(Tokens.TypeWeight.bodyS)
    case .caption: return Self.fontWeight(Tokens.TypeWeight.caption)
    case .eyebrow, .step: return Self.fontWeight(Tokens.TypeWeight.eyebrow)
    }
  }

  /// CSS weight number → SwiftUI weight.
  static func fontWeight(_ css: Int) -> Font.Weight {
    switch css {
    case ..<350: return .light
    case ..<450: return .regular
    case ..<550: return .medium
    case ..<650: return .semibold
    case ..<750: return .bold
    case ..<850: return .heavy
    default: return .black
    }
  }

  var font: Font {
    let name = isDisplay ? Tokens.FontName.display : Tokens.FontName.body
    return .custom(name, size: size, relativeTo: textStyle).weight(weight)
  }

  /// letterSpacing in tokens.json is em-based; converted to points here.
  var tracking: CGFloat {
    switch self {
    case .eyebrow, .step: return 1  // type.eyebrow.letterSpacing 1px (v3)
    case .displayXL, .displayL: return size * -0.04
    case .displayM: return size * -0.03
    default: return 0
    }
  }

  /// `type.<role>.lineHeight` in tokens.json (a multiple of the size; nil = the font's own).
  /// Mirrored by hand (the generator does not emit it) and checked by ThemeEffectsTests.
  var lineHeight: CGFloat? {
    switch self {
    case .displayXL, .displayL: return 1.13
    case .displayM: return 1.2
    case .titleL, .eyebrow, .step: return 1.3
    case .bodyL, .body: return 1.5
    case .bodyS, .caption: return 1.4
    default: return nil
    }
  }

  /// Extra space between lines so the line height reaches `lineHeight` (SwiftUI cannot tighten lines,
  /// so the tighter display heights keep Outfit's own). Scales with Dynamic Type like the font.
  var lineSpacing: CGFloat {
    guard let lineHeight,
          let font = UIFont(name: isDisplay ? Tokens.FontName.display : Tokens.FontName.body, size: size)
    else { return 0 }
    let extra = size * lineHeight - font.lineHeight
    return extra > 0 ? UIFontMetrics(forTextStyle: textStyle.uiKit).scaledValue(for: extra) : 0
  }

  var uppercased: Bool {
    switch self {
    case .eyebrow, .step: return true
    default: return false
    }
  }
}

private extension Font.TextStyle {
  var uiKit: UIFont.TextStyle {
    switch self {
    case .largeTitle: return .largeTitle
    case .title: return .title1
    case .title2: return .title2
    case .title3: return .title3
    case .headline: return .headline
    case .subheadline: return .subheadline
    case .callout: return .callout
    case .footnote: return .footnote
    case .caption: return .caption1
    case .caption2: return .caption2
    default: return .body
    }
  }
}

extension View {
  /// Applies a token type role (font, tracking, case).
  func themeFont(_ role: TextRole) -> some View {
    self
      .font(role.font)
      .tracking(role.tracking)
      .lineSpacing(role.lineSpacing)
      .textCase(role.uppercased ? .uppercase : nil)
  }
}
