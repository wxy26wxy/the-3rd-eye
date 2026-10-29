import SwiftUI

/// AsyncImage with a token-styled placeholder and an accessibility description.
struct RemoteImage: View {
  let url: URL?
  let altText: String?
  var contentMode: ContentMode = .fit
  @Environment(\.themeColors) private var colors

  var body: some View {
    AsyncImage(url: url) { phase in
      switch phase {
      case .success(let image):
        image.resizable().aspectRatio(contentMode: contentMode)
      case .failure:
        placeholder(systemName: "photo")
      default:
        placeholder(systemName: nil)
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text(altText ?? String(localized: "Artwork")))
    .accessibilityAddTraits(.isImage)
  }

  private func placeholder(systemName: String?) -> some View {
    ZStack {
      RoundedRectangle(cornerRadius: Theme.Radius.m).fill(colors.surfaceAlt)
      if let systemName {
        Image(systemName: systemName).font(TextRole.displayM.font).foregroundStyle(colors.textMuted)
      } else {
        ProgressView().tint(colors.text)
      }
    }
    .aspectRatio(1, contentMode: .fit)
  }
}
