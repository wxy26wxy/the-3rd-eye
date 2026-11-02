import SwiftUI

/// Board "Making your cutout" (`4030:4482`; the making animation since T122 R7): the changed art is cut out (`POST /artworks/{id}/cutout`,
/// the largest piece SAM finds). Art kept as it was picked already has its cut-out from Choose a
/// pattern, so it goes straight on. Your cutout replaces this screen, so Back skips it.
struct MakingCutoutView: View {
  @Environment(AppState.self) private var app
  @State private var error: String?
  @State private var attempt = 0

  var body: some View {
    LoadingScreen(
      title: "Making your cutout",
      detail: "Cutting out your art. This takes a few seconds.",
      media: .animation(resource: Tokens.Asset.stickerLoading, aspect: ThemeEffects.productLoadingAspect,
                        radius: ThemeEffects.artPreviewRadius, reduced: .firstFrame),
      error: error,
      retry: { error = nil; attempt += 1 },
      backLabel: "Back to my art"
    )
    .task(id: attempt) { await run() }
  }

  private func run() async {
    let flow = app.flow
    guard let art = flow.currentArt else {
      error = String(localized: "Your art is missing. Go back and pick it again.")
      return
    }
    // The drawing as it was picked: its cut-out exists (`select`), on the photo's pieces.
    if art.id == flow.photoArtwork?.id, art.cleanedUrl != nil {
      flow.resetCutout(artwork: art, candidates: flow.photoCandidates, imageSize: flow.photoImageSize,
                       selected: flow.pieceCutFrom.map { [$0] } ?? [])
      leave()
      return
    }
    do {
      let res = try await app.api.cutout(artworkId: art.id)
      var cut = res.artwork
      if cut.altText?.isEmpty ?? true { cut.altText = art.altText }
      if cut.spokenDescription?.isEmpty ?? true { cut.spokenDescription = art.spokenDescription }
      // The server cut out the largest piece, `candidates[0]`; the edge tools work on that one.
      flow.resetCutout(artwork: cut, candidates: res.candidates, imageSize: res.imageSize,
                       selected: res.candidates.first.map { [$0.id] } ?? [])
      if flow.changedArtwork?.id == cut.id { flow.changedArtwork = cut } else if flow.pieceArtwork?.id == cut.id { flow.pieceArtwork = cut }
      leave()
    } catch is CancellationError {
      return
    } catch {
      if APIError.isCancellation(error) { return }
      self.error = error.localizedDescription
    }
  }

  private func leave() {
    if app.createPath.last == .makingCutout { app.replaceTop(with: .yourCutout) }
  }
}
