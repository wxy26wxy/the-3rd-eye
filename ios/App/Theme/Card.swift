import SwiftUI

/// Cream sheet with a 3 pt ink border, 28 pt corners and a hard shadow.
struct Card<Content: View>: View {
  var selected: Bool = false
  var padding: CGFloat = Theme.Space.xl
  @ViewBuilder var content: Content
  @Environment(\.themeColors) private var colors

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
    content
      .padding(padding)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(shape.fill(selected ? colors.selected : colors.surface))
      .overlay(shape.stroke(colors.border, lineWidth: Theme.Border.card))
      .hardShadow(Theme.Shadow.hardL, in: shape)
  }
}

/// A tappable Card used for choices (product, method). Selected = lime + check.
struct ChoiceCard<Content: View>: View {
  let selected: Bool
  let label: Text
  var hint: Text = Text("")
  let action: () -> Void
  @ViewBuilder var content: Content
  @Environment(\.themeColors) private var colors

  var body: some View {
    Button(action: action) {
      Card(selected: selected) {
        HStack(alignment: .center, spacing: Theme.Space.l) {
          content
          Spacer(minLength: 0)
          if selected {
            Image(systemName: "checkmark")
              .font(TextRole.titleL.font.weight(.heavy))
              .foregroundStyle(colors.primaryText)
              .frame(width: Theme.Size.iconButton, height: Theme.Size.iconButton)
              .background(Circle().fill(colors.primary))
              .accessibilityHidden(true)
          }
        }
        .frame(minHeight: Theme.Size.cta)
      }
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(label)
    .accessibilityHint(hint)
    .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
  }
}
