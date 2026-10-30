import SwiftUI

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

  /// Inter weight for the role: `type.<role>.weight` in tokens.json (Tokens.TypeWeight), on the variable font axis.
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
    case .eyebrow, .step: return size * 0.08
    case .displayXL, .displayL: return size * -0.04
    case .displayM: return size * -0.03
    default: return 0
    }
  }

  var uppercased: Bool {
    switch self {
    case .eyebrow, .step: return true
    default: return false
    }
  }
}

extension View {
  /// Applies a token type role (font, tracking, case).
  func themeFont(_ role: TextRole) -> some View {
    self
      .font(role.font)
      .tracking(role.tracking)
      .textCase(role.uppercased ? .uppercase : nil)
  }
}
