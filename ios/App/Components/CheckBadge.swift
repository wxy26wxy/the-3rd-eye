import SwiftUI

/// Ink circle with a white check (Figma `Selected check` / piece chip `Check`). Decorative.
struct CheckBadge: View {
  var size: CGFloat
  @Environment(\.themeColors) private var colors

  var body: some View {
    Image(Tokens.Asset.iconCheck)
      .renderingMode(.template)
      .resizable()
      .scaledToFit()
      .foregroundStyle(colors.primaryText)
      .padding(size * 0.22)
      .frame(width: size, height: size)
      .background(Circle().fill(colors.primary))
      .accessibilityHidden(true)
  }
}
