import SwiftUI

/// The eye logo mark (`logo-mark`, 40 × 35, ink; white on a photo). Decorative: the screen title
/// names the screen, so VoiceOver skips it.
struct LogoMark: View {
  var onPhoto = false
  @Environment(\.themeColors) private var colors

  var body: some View {
    Image(Tokens.Asset.logoMark)
      .renderingMode(.template)
      .resizable()
      .scaledToFit()
      .foregroundStyle(onPhoto ? colors.textOnDark : colors.text)
      .frame(width: Theme.Size.logoMark.width, height: Theme.Size.logoMark.height)
      .accessibilityHidden(true)
  }
}
