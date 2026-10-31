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
      pose: .magnifier,
      error: error,
      retry: { error = nil; attempt += 1 },
      cardAspect: ThemeEffects.tallSkyCardAspect,
      showsSpinner: false
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
      app.flow.photoArtwork = res.artwork
      app.flow.resetCutout(candidates: res.candidates, imageSize: res.imageSize)
      if res.candidates.count <= 1, res.artwork.cleanedUrl != nil {
        app.flow.artwork = res.artwork
        app.replaceTop(with: .designReady)
      } else {
        app.replaceTop(with: .adjustCutout)
      }
    } catch is CancellationError {
      return
    } catch {
      self.error = error.localizedDescription
    }
  }
}
