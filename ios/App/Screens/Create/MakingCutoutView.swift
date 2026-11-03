import SwiftUI

/// Board "Making your cutout" (`4030:4482`; the making animation since T122 R7). Two jobs (T131):
/// the frame from Adjust the area cuts the photo's piece (`POST /artworks/{id}/cleanup {candidateIds?,
/// box, clipToBox: true}`), or a kept change is cut out (`POST /artworks/{id}/cutout`, once per
/// artwork: `CreateFlow.changeCuts`). Your cutout replaces this screen, so Back skips it.
///
/// The request runs in its own task: leaving the tab does not cancel it (the server saves the cut
/// anyway), and coming back does not send it twice.
struct MakingCutoutView: View {
  let job: CutJob
  @Environment(AppState.self) private var app
  @State private var error: String?
  @State private var attempt = 0
  @State private var running = false

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
    .task(id: attempt) {
      guard !running, error == nil else { return }
      running = true
      let flow = app.flow
      await Task { @MainActor in await run(flow) }.value
      running = false
    }
  }

  private func run(_ flow: CreateFlow) async {
    switch job {
    case .area(let request): await cutArea(request, flow: flow)
    case .change(let id): await cutChange(id, flow: flow)
    }
  }

  /// The frame on the photo: the piece is cut (and clipped to the frame); a new piece cut drops the
  /// changes made from the old one.
  private func cutArea(_ request: CleanupRequest, flow: CreateFlow) async {
    guard let photo = flow.photoArtwork else {
      error = String(localized: "Your art is missing. Go back and pick it again.")
      return
    }
    do {
      let result = try await app.api.cleanup(artworkId: photo.id, request)
      var cut = result.artwork
      if cut.altText?.isEmpty ?? true { cut.altText = photo.altText }
      flow.resetChange()
      flow.recordCut(of: photo.id, cut, request: request)
      leave(to: photo.id, flow: flow)
    } catch {
      if let message = CleanupResult.errorMessage(for: error) { self.error = message }
    }
  }

  /// A kept change: SAM finds its pieces and the largest becomes the cut-out; its pieces stay with
  /// it, so the edge tools send that piece with the marks.
  private func cutChange(_ id: String, flow: CreateFlow) async {
    if flow.changeCuts[id] != nil {
      leave(to: id, flow: flow)
      return
    }
    guard let art = flow.changes.first(where: { $0.artwork.id == id })?.artwork else {
      error = String(localized: "Your art is missing. Go back and pick it again.")
      return
    }
    do {
      let res = try await app.api.cutout(artworkId: id)
      var cut = res.artwork
      if cut.altText?.isEmpty ?? true { cut.altText = art.altText }
      if cut.spokenDescription?.isEmpty ?? true { cut.spokenDescription = art.spokenDescription }
      var candidates = res.candidates
      var size = res.imageSize
      // The pieces are also on GET /artworks/{id} after the cutout (docs/api.md, round 2b step 9).
      if candidates.isEmpty || size?.isUsable != true, let detail = try? await app.api.artworkDetail(id: id) {
        if candidates.isEmpty { candidates = detail.candidates }
        if size?.isUsable != true { size = detail.imageSize }
      }
      // The server cut out the largest piece, `candidates[0]`; the edge tools send it with the marks.
      flow.changeCuts[id] = Cut(artwork: cut, candidates: candidates, imageSize: size,
                                selected: candidates.first.map { [$0.id] } ?? [], box: nil)
      flow.updateChange(cut)
      leave(to: id, flow: flow)
    } catch {
      if APIError.isCancellation(error) { return }
      self.error = error.localizedDescription
    }
  }

  private func leave(to artworkId: String, flow: CreateFlow) {
    guard flow === app.flow, app.createPath.last == .makingCutout(job) else { return }
    app.replaceTop(with: .yourCutout(artworkId))
  }
}
