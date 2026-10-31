import SwiftUI

/// The creator's sticker on a white card (Sky boards "Your sticker is ready!" and "You're live!"):
/// 28 pt corners and the one soft shadow, the artwork fitted inside. Without an artwork picture it
/// shows the mascot sticker from the boards (decorative).
struct StickerCard: View {
  let url: URL?
  let altText: String?
  let size: CGSize
  @Environment(\.themeColors) private var colors

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
    Group {
      if url != nil {
        RemoteImage(url: url, altText: altText)
          .padding(Theme.Space.l)
          .frame(width: size.width, height: size.height)
          .background(shape.fill(colors.surface))
          .overlay(shape.strokeBorder(colors.border, lineWidth: Theme.Border.thin))
          .softShadow()
      } else {
        Image(Tokens.Asset.mascotBook)
          .resizable()
          .scaledToFit()
          .frame(width: size.width, height: size.height)
          .accessibilityHidden(true)
      }
    }
  }
}
