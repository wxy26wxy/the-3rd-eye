import SwiftUI

/// Sky icon button (Figma `Icon button`, `Back`): white circle with a 1 pt border and an ink glyph.
/// 48 pt by default; `size: Theme.Size.minTarget` (44) for Back and Sign out, as on the boards.
struct IconButton: View {
  private let glyph: Image
  let label: LocalizedStringKey
  var hint: LocalizedStringKey?
  var size: CGFloat
  let action: () -> Void

  init(systemName: String, label: LocalizedStringKey, hint: LocalizedStringKey? = nil, size: CGFloat = Theme.Size.iconButton,
       action: @escaping () -> Void) {
    self.glyph = Image(systemName: systemName)
    self.label = label
    self.hint = hint
    self.size = size
    self.action = action
  }

  /// A template image from the asset catalog (e.g. `Tokens.Asset.iconChevronRight`).
  init(asset: String, label: LocalizedStringKey, hint: LocalizedStringKey? = nil, size: CGFloat = Theme.Size.iconButton,
       mirrored: Bool = false, action: @escaping () -> Void) {
    self.glyph = Image(asset)
    self.label = label
    self.hint = hint
    self.size = size
    self.action = action
    self.mirrored = mirrored
  }

  private var mirrored = false
  @Environment(\.themeColors) private var colors

  var body: some View {
    Button(action: action) {
      glyph
        .renderingMode(.template)
        .resizable()
        .scaledToFit()
        .fontWeight(TextRole.titleM.weight)
        .frame(width: ThemeEffects.iconGlyph, height: ThemeEffects.iconGlyph)
        .scaleEffect(x: mirrored ? -1 : 1)
        .foregroundStyle(colors.text)
        .frame(width: size, height: size)
    }
    .buttonStyle(IconButtonStyle())
    .accessibilityLabel(Text(label))
    .accessibilityHint(hint.map { Text($0) } ?? Text(""))
  }
}

private struct IconButtonStyle: ButtonStyle {
  @Environment(\.themeColors) private var colors

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .background(Circle().fill(colors.surface))
      .overlay(Circle().strokeBorder(colors.border, lineWidth: Theme.Border.thin))
      .opacity(configuration.isPressed ? ThemeEffects.pressedOpacity : 1)
      .contentShape(Circle())
  }
}
