import SwiftUI

struct MyDesignsView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var artworks: [Artwork] = []
  @State private var loading = true
  @State private var error: String?

  private let columns = [GridItem(.adaptive(minimum: ThemeEffects.gridMinimum), spacing: Theme.Space.l)]

  var body: some View {
    TabScreen(title: "My designs") {
      if loading && artworks.isEmpty {
        ProgressView().tint(colors.text).frame(maxWidth: .infinity).accessibilityLabel(Text("Loading your designs"))
      } else if let error {
        ErrorCard(message: error) { Task { await load() } }
      } else if artworks.isEmpty {
        Text("No designs yet. Make one in Create.").themeFont(.bodyL).foregroundStyle(colors.text)
        PillButton("Start creating") { app.startNewCreation() }
      } else {
        LazyVGrid(columns: columns, spacing: Theme.Space.l) {
          ForEach(artworks) { artwork in
            // Tapping a tile does nothing yet; a detail screen comes later.
            RemoteImage(url: artwork.displayURL, altText: artwork.altText)
              .padding(Theme.Space.xs)
              .background(RoundedRectangle(cornerRadius: Theme.Radius.m).fill(colors.surfaceAlt))
              .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.thin))
              .accessibilityElement(children: .ignore)
              .accessibilityLabel(Text(artwork.altText ?? String(localized: "Design")))
              .accessibilityAddTraits(.isImage)
          }
        }
      }
    }
    .task { await load() }
    .refreshable { await load() }
  }

  private func load() async {
    loading = true
    defer { loading = false }
    do {
      artworks = try await app.api.myArtworks()
      error = nil
    } catch is CancellationError {
      return
    } catch {
      self.error = error.localizedDescription
    }
  }
}
