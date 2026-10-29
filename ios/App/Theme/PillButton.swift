import SwiftUI

/// Primary CTA: 60 pt ink capsule, cream label, lime arrow circle, hard shadow.
/// `.secondary` is the cream outlined variant (56 pt).
struct PillButtonStyle: ButtonStyle {
  enum Kind { case primary, secondary }
  var kind: Kind = .primary
  var showsArrow: Bool = true
  @Environment(\.themeColors) private var colors
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  func makeBody(configuration: Configuration) -> some View {
    let fill = kind == .primary ? colors.primary : colors.surface
    let label = kind == .primary ? colors.primaryText : colors.text
    let shadow = kind == .primary ? Theme.Shadow.primary : Theme.Shadow.hard
    return HStack(spacing: Theme.Space.m) {
      configuration.label
        .themeFont(.titleM)
        .foregroundStyle(label)
        .multilineTextAlignment(.leading)
        .frame(maxWidth: .infinity, alignment: .leading)
      if showsArrow {
        Image(systemName: "arrow.right")
          .font(TextRole.titleM.font.weight(.heavy))
          .foregroundStyle(colors.accentInk)
          .frame(width: Theme.Size.iconButton, height: Theme.Size.iconButton)
          .background(Circle().fill(colors.accent))
          .overlay(Circle().stroke(colors.border, lineWidth: Theme.Border.thin))
          .accessibilityHidden(true)
      }
    }
    .padding(.leading, Theme.Space.xxl)
    .padding(.trailing, showsArrow ? Theme.Space.xs : Theme.Space.xxl)
    .padding(.vertical, Theme.Space.xs)
    .frame(minHeight: kind == .primary ? Theme.Size.cta : Theme.Size.ctaSecondary)
    .background(Capsule().fill(fill))
    .overlay(Capsule().stroke(colors.border, lineWidth: Theme.Border.card))
    .hardShadow(shadow, in: Capsule(), pressed: configuration.isPressed && !reduceMotion)
    .opacity(isEnabled ? 1 : 0.5)
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
