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
    case .step: return Tokens.TypeScale.step
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

  /// Rubik weight for the role in tokens.json (variable font axis).
  private var bodyWeight: Font.Weight {
    switch self {
    case .titleL: return .heavy
    case .titleM, .eyebrow, .step: return .bold
    case .body: return .semibold
    default: return .medium
    }
  }

  var font: Font {
    if isDisplay {
      return .custom(Tokens.FontName.display, size: size, relativeTo: textStyle)
    }
    return .custom(Tokens.FontName.body, size: size, relativeTo: textStyle).weight(bodyWeight)
  }

  /// letterSpacing in tokens.json is em-based; converted to points here.
  var tracking: CGFloat {
    switch self {
    case .eyebrow: return size * 0.12
    case .step: return size * 0.08
    case .displayXL, .displayL, .displayM: return size * 0.01
    default: return 0
    }
  }

  var uppercased: Bool {
    switch self {
    case .eyebrow, .step, .displayXL, .displayL, .displayM: return true
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
