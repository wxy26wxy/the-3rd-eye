import SwiftUI

/// Sky card: white (or accent green when `selected`), 28 pt corners, 1.5 pt border
/// (`accentBorder` on green), no shadow. Content on green should use `colors.accentInk`.
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
      .overlay(shape.strokeBorder(selected ? colors.accentBorder : colors.border, lineWidth: Theme.Border.card))
  }
}

/// A tappable Card for choices (product). Selected = green card + a deep-green radio with a check;
/// unselected = white card + an empty radio (selection is never shown by colour alone).
struct ChoiceCard<Content: View>: View {
  let selected: Bool
  let label: Text
  var hint: Text = Text("")
  let action: () -> Void
  @ViewBuilder var content: Content

  var body: some View {
    Button(action: action) {
      Card(selected: selected) {
        HStack(alignment: .top, spacing: Theme.Space.l) {
          content
          Spacer(minLength: 0)
          RadioMark(selected: selected)
        }
        .frame(minHeight: Theme.Size.cta, alignment: .top)
      }
    }
    .buttonStyle(.plain)
    .accessibilityLabel(label)
    .accessibilityHint(hint)
    .accessibilityAddTraits(selected ? .isSelected : [])
  }
}

/// 24 pt radio: deep green with a white check when selected, `surfaceAlt` with a 1 pt border when not.
struct RadioMark: View {
  let selected: Bool
  @Environment(\.themeColors) private var colors

  var body: some View {
    ZStack {
      if selected {
        Circle().fill(colors.accentInk)
        Image(Tokens.Asset.iconCheck)
          .renderingMode(.template)
          .resizable()
          .scaledToFit()
          .foregroundStyle(colors.primaryText)
          .padding(Theme.Space.xs)
      } else {
        Circle().fill(colors.surfaceAlt)
        Circle().strokeBorder(colors.border, lineWidth: Theme.Border.thin)
      }
    }
    .frame(width: Theme.Size.radio, height: Theme.Size.radio)
    .accessibilityHidden(true)
  }
}
