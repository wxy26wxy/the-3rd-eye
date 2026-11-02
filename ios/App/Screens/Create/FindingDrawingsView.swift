import SwiftUI

/// Board "Finding drawings · Cloud studio" (`21:4390`): upload the photo and let SAM find every
/// drawing on it; the tall green card with the searching mascot and one line under it.
struct FindingDrawingsView: View {
  @Environment(AppState.self) private var app
  @State private var error: String?
  @State private var attempt = 0

  var body: some View {
    LoadingScreen(
      title: "Finding your drawings…",
      detail: "This takes a few seconds…",
      media: .animation(resource: Tokens.Asset.mascotMagnifier, aspect: ThemeEffects.tallSkyCardAspect),
      error: error,
      retry: { error = nil; attempt += 1 },
      showsSpinner: false,
      mutedDetail: true
    )
    .task(id: attempt) { await run() }
  }

  private func run() async {
    guard let photo = app.flow.photo, let product = app.flow.productType, let data = ImageTools.jpeg(photo) else {
      error = String(localized: "The photo is missing. Go back and take it again.")
      return
    }
    do {
      if app.creator == nil { await app.refreshCreator() }
      guard let creatorId = app.creator?.id else { throw APIError.unauthorized }
      let uploaded = try await BlobUploader(api: app.api).upload(data, creatorId: creatorId, kind: .photo, contentType: "image/jpeg", fileExtension: "jpg")
      let res = try await app.api.artworkFromPhoto(imageUrl: uploaded.url, product: product)
      app.flow.setPhoto(artwork: res.artwork, candidates: res.candidates, imageSize: res.imageSize)
      if res.candidates.count <= 1, res.artwork.cleanedUrl != nil {
        // One drawing, already cut out: nothing to choose, straight to Change it.
        app.flow.pieceArtwork = res.artwork
        app.flow.pieceCutFrom = res.candidates.first?.id
        app.replaceTop(with: .changeIt)
      } else {
        app.replaceTop(with: .choosePattern)
      }
    } catch is CancellationError {
      return
    } catch {
      self.error = error.localizedDescription
    }
  }
}
