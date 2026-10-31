import SwiftUI

/// A way to make art (Figma `Creation option`, Choose how to make it): a 44 pt icon tile, the name,
/// a description, an optional eyebrow above the name and a chevron. White row with a 1 pt border and
/// 18 pt corners; `highlighted` = the accent row. One button for VoiceOver: "name, description".
struct MethodRow: View {
  let icon: String
  let name: LocalizedStringKey
  let detail: LocalizedStringKey
  var eyebrow: LocalizedStringKey?
  var highlighted = false
  var hint: LocalizedStringKey = "Opens this way of making art"
  let action: () -> Void
  @Environment(\.themeColors) private var colors

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
    Button(action: action) {
      HStack(spacing: Theme.Space.m) {
        Image(icon)
          .renderingMode(.template)
          .resizable()
          .scaledToFit()
          .frame(width: ThemeEffects.iconGlyph, height: ThemeEffects.iconGlyph)
          .foregroundStyle(colors.accentInk)
          .frame(width: Theme.Size.methodIcon, height: Theme.Size.methodIcon)
          .background(Circle().fill(highlighted ? colors.surface.opacity(ThemeEffects.iconTileOpacity * 2) : colors.accent.opacity(ThemeEffects.iconTileOpacity)))
          .accessibilityHidden(true)
        VStack(alignment: .leading, spacing: Theme.Space.xs / 2) {
          if let eyebrow {
            Text(eyebrow).themeFont(.eyebrow).foregroundStyle(colors.accentInk)
          }
          Text(name).themeFont(.titleL).foregroundStyle(colors.accentInk)
          Text(detail).themeFont(.bodyS).foregroundStyle(colors.accentInk)
        }
        .multilineTextAlignment(.leading)
        Spacer(minLength: 0)
        Image(Tokens.Asset.iconChevronRight)
          .renderingMode(.template)
          .resizable()
          .scaledToFit()
          .frame(width: ThemeEffects.iconGlyph, height: ThemeEffects.iconGlyph)
          .foregroundStyle(colors.accentInk)
          .accessibilityHidden(true)
      }
      .padding(Theme.Space.l)
      .frame(maxWidth: .infinity, minHeight: Theme.Size.cta + Theme.Space.l, alignment: .leading)
      .background(shape.fill(highlighted ? colors.accent : colors.surface))
      .overlay(shape.strokeBorder(highlighted ? colors.accentBorder : colors.border, lineWidth: Theme.Border.thin))
      .contentShape(shape)
    }
    .buttonStyle(MethodRowStyle())
    .accessibilityLabel(Text(name) + Text(", ") + Text(detail))
    .accessibilityHint(Text(hint))
  }
}

private struct MethodRowStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label.opacity(configuration.isPressed ? ThemeEffects.pressedOpacity : 1)
  }
}
