import SwiftUI

/// Sky actions (Figma `Primary action` / `Secondary action`).
/// - `.primary`: 56 pt ink pill, white Inter Semi Bold 16 label, a 48 pt ink arrow circle at the right.
/// - `.onPhoto`: the same pill in white with ink text (Welcome, on the sky photo).
/// - `.secondary`: 50 pt white pill with a 1 pt border, centred ink label, no arrow.
/// Disabled = `opacity.disabled`. The arrow is decorative.
struct PillButtonStyle: ButtonStyle {
  enum Kind { case primary, secondary, onPhoto }
  var kind: Kind = .primary
  var showsArrow: Bool = true
  @Environment(\.themeColors) private var colors
  @Environment(\.isEnabled) private var isEnabled

  func makeBody(configuration: Configuration) -> some View {
    let isSecondary = kind == .secondary
    let fill: Color = kind == .primary ? colors.primary : colors.surface
    let label: Color = kind == .primary ? colors.primaryText : colors.text
    let arrow = showsArrow && !isSecondary
    return HStack(spacing: Theme.Space.m) {
      configuration.label
        .themeFont(isSecondary ? .body : .titleM)
        .foregroundStyle(label)
        .multilineTextAlignment(isSecondary ? .center : .leading)
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: isSecondary ? .center : .leading)
      if arrow {
        Image(Tokens.Asset.iconArrow)
          .renderingMode(.template)
          .resizable()
          .scaledToFit()
          .frame(width: ThemeEffects.ctaGlyph, height: ThemeEffects.ctaGlyph)
          .foregroundStyle(colors.primaryText)
          .frame(width: Theme.Size.ctaArrow, height: Theme.Size.ctaArrow)
          .background(Circle().fill(colors.primary))
          .accessibilityHidden(true)
      }
    }
    .padding(.leading, isSecondary ? Theme.Space.xxl : ThemeEffects.ctaLeading)
    .padding(.trailing, arrow ? ThemeEffects.ctaInset : Theme.Space.xxl)
    .padding(.vertical, ThemeEffects.ctaInset)
    .frame(maxWidth: .infinity, minHeight: isSecondary ? Theme.Size.ctaSecondary : Theme.Size.cta)
    .background(Capsule().fill(fill))
    .overlay {
      if isSecondary || colors.border == colors.text {
        Capsule().stroke(colors.border, lineWidth: Theme.Border.thin)
      }
    }
    .compositingGroup()
    .opacity(isEnabled ? (configuration.isPressed ? ThemeEffects.pressedOpacity : 1) : Theme.Opacity.disabled)
    .contentShape(Capsule())
  }
}

struct PillButton: View {
  let title: LocalizedStringKey
  var hint: LocalizedStringKey?
  var kind: PillButtonStyle.Kind = .primary
  var showsArrow: Bool = true
  let action: () -> Void

  init(_ title: LocalizedStringKey, hint: LocalizedStringKey? = nil, kind: PillButtonStyle.Kind = .primary, showsArrow: Bool = true, action: @escaping () -> Void) {
    self.title = title
    self.hint = hint
    self.kind = kind
    self.showsArrow = showsArrow
    self.action = action
  }

  var body: some View {
    Button(action: action) { Text(title) }
      .buttonStyle(PillButtonStyle(kind: kind, showsArrow: showsArrow))
      .accessibilityLabel(Text(title))
      .accessibilityHint(hint.map { Text($0) } ?? Text(""))
  }
}
