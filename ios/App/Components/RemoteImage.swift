import SwiftUI

/// A picture from a link with a token-styled placeholder and an accessibility description. Loaded
/// through `ImageLoader` (Ruling 3, T144): a picture already in memory draws in the first frame,
/// with no spinner; tiles pass `maxPixel` for a downsampled copy.
struct RemoteImage: View {
  let url: URL?
  let altText: String?
  var contentMode: ContentMode = .fit
  /// Longest side to decode (tiles: `ImageLoader.tilePixels`); nil = the whole picture.
  var maxPixel: Int?
  @Environment(\.themeColors) private var colors
  @State private var loaded: Loaded?
  @State private var failedKey: String?

  private struct Loaded {
    let key: String
    let image: UIImage
  }

  init(url: URL?, altText: String?, contentMode: ContentMode = .fit, maxPixel: Int? = nil) {
    self.url = url
    self.altText = altText
    self.contentMode = contentMode
    self.maxPixel = maxPixel
  }

  private var key: String? { url.map { ImageCache.key(for: $0, maxPixel: maxPixel) } }

  /// The picture for the current link: loaded here, or already in the memory cache.
  private var image: UIImage? {
    guard let key else { return nil }
    if let loaded, loaded.key == key { return loaded.image }
    return ImageCache.shared.image(forKey: key)
  }

  var body: some View {
    Group {
      if let image {
        Image(uiImage: image).resizable().aspectRatio(contentMode: contentMode)
      } else if let key, failedKey == key {
        placeholder(systemName: "photo")
      } else {
        placeholder(systemName: nil)
          .preference(key: RemoteImageLoadingKey.self, value: url != nil)
      }
    }
    .task(id: key) { await load() }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text(altText ?? String(localized: "Artwork")))
    .accessibilityAddTraits(.isImage)
  }

  private func load() async {
    guard let url, let key, image == nil else { return }
    do {
      let picture = try await ImageLoader.shared.image(for: url, maxPixel: maxPixel)
      loaded = Loaded(key: key, image: picture)
      if failedKey == key { failedKey = nil }
    } catch {
      if error is CancellationError || (error as? URLError)?.code == .cancelled { return }
      failedKey = key
    }
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

/// True while a `RemoteImage` under the view is still loading its picture (My designs tiles expose
/// it to UI tests as the `tile-loading` identifier).
struct RemoteImageLoadingKey: PreferenceKey {
  static let defaultValue = false
  static func reduce(value: inout Bool, nextValue: () -> Bool) { value = value || nextValue() }
}
