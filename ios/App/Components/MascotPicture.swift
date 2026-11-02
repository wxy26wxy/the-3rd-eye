import SwiftUI

/// A mascot picture (T122 R7: `mascotCard` on Take a photo / Upload a picture, `mascotShop` on
/// You're live) on a 28 pt card at its own proportions, described for VoiceOver (copy v4).
struct MascotPicture: View {
  let asset: String
  let description: LocalizedStringKey

  var body: some View {
    Image(asset)
      .resizable()
      .scaledToFit()
      .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
      .frame(maxWidth: .infinity, maxHeight: Theme.photoMaxHeight)
      .accessibilityLabel(Text(description))
      .accessibilityAddTraits(.isImage)
  }
}
