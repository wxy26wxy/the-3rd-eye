import SwiftUI

/// The short upload step (round 3): "Getting your photo ready…" over the photo while it is uploaded
/// and stored (`POST /artworks {detect: false}`, no drawing looked for); then Adjust the area on the
/// whole photo. The searching mascot moved to Making your cutout (`detect`).
struct FindingDrawingsView: View {
  @Environment(AppState.self) private var app
  @State private var error: String?
  @State private var attempt = 0

  var body: some View {
    LoadingScreen(
      title: "Getting your photo ready…",
      detail: "This takes a few seconds…",
      media: .art(nil, photo: app.flow.photo),
      error: error,
      retry: { error = nil; attempt += 1 },
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
      let api = app.api
      let uploaded = try await BackgroundWork.run("photo-upload") {
        try await BlobUploader(api: api).upload(data, creatorId: creatorId, kind: .photo, contentType: "image/jpeg", fileExtension: "jpg")
      }
      let res = try await app.api.artworkFromPhoto(imageUrl: uploaded.url, product: product, detect: false)
      app.flow.setPhoto(artwork: res.artwork, candidates: [], imageSize: res.imageSize)
      // Always Adjust the area next, the frame on the whole photo; `detect` looks inside it.
      if app.createPath.last == .findingDrawings { app.replaceTop(with: .adjustArea) }
    } catch let none as NoDrawingFound {
      // An older server that still looks for drawings and found none (T131): not a dead end. The photo is stored; Adjust the area opens on the
      // whole photo, with the stored original's size so the frame is in its pixels.
      await rescue(none)
    } catch is CancellationError {
      return
    } catch {
      self.error = error.localizedDescription
    }
  }

  private func rescue(_ none: NoDrawingFound) async {
    do {
      let detail = try await app.api.artworkDetail(id: none.artworkId)
      app.flow.setPhoto(artwork: detail.artwork, candidates: [], imageSize: detail.imageSize)
      if app.createPath.last == .findingDrawings { app.replaceTop(with: .adjustArea) }
    } catch {
      if APIError.isCancellation(error) { return }
      self.error = error.localizedDescription
    }
  }
}
