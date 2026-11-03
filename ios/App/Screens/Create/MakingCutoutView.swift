import SwiftUI

/// Board "Making your cutout" (`4030:4482`). Two jobs: the frame from Adjust the area (round 3:
/// `POST /artworks/{id}/detect {box}` finds the drawings inside the frame and cuts out the largest,
/// with the searching mascot), or a kept change is cut out (`POST /artworks/{id}/cutout`, once per
/// artwork: `CreateFlow.changeCuts`, with the making animation). Your cutout replaces this screen,
/// so Back skips it. Nothing found in the frame goes back to Adjust the area, which says to move or
/// grow the frame.
///
/// The request runs in its own task: leaving the tab does not cancel it (the server saves the cut
/// anyway), and coming back does not send it twice. A lost answer (or a return to the app while it
/// runs) is looked for on the server first (`CreateFlow.reconcile`, round 3 ruling 6).
struct MakingCutoutView: View {
  let job: CutJob
  @Environment(AppState.self) private var app
  @State private var error: String?
  @State private var attempt = 0
  @State private var running = false

  private var isDetect: Bool { if case .detect = job { return true } else { return false } }

  var body: some View {
    LoadingScreen(
      title: "Making your cutout",
      detail: isDetect ? "Looking for your drawing in the frame and cutting it out. This takes a few seconds." : "Cutting out your art. This takes a few seconds.",
      media: isDetect
        ? .animation(resource: Tokens.Asset.mascotMagnifier, aspect: ThemeEffects.tallSkyCardAspect)
        : .animation(resource: Tokens.Asset.stickerLoading, aspect: ThemeEffects.productLoadingAspect,
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
    .onChange(of: app.flow.resumeCount) { _, _ in
      let flow = app.flow
      Task { @MainActor in await recover(flow) }
    }
  }

  private func run(_ flow: CreateFlow) async {
    switch job {
    case .detect(let box): await detect(box, flow: flow)
    case .change(let id): await cutChange(id, flow: flow)
    }
  }

  private func pending(_ flow: CreateFlow) -> PendingJob? {
    switch job {
    case .detect:
      guard let photo = flow.photoArtwork else { return nil }
      return flow.startJob(.cut(artworkId: photo.id, previousCut: flow.pieceArtwork?.cleanedUrl, needsCandidates: true))
    case .change(let id):
      return flow.startJob(.cut(artworkId: id, previousCut: nil, needsCandidates: false))
    }
  }

  /// The frame on the photo: SAM looks inside it; the largest drawing is cut out (clipped to the
  /// frame). A new piece drops the changes made from the old one.
  private func detect(_ box: [Double], flow: CreateFlow) async {
    guard let photo = flow.photoArtwork, let pending = pending(flow) else {
      error = String(localized: "Your art is missing. Go back and pick it again.")
      return
    }
    do {
      let res = try await app.api.detect(artworkId: photo.id, box: box)
      guard flow.finishJob(pending) else { return }
      flow.recordDetect(res, box: box)
      leave(to: photo.id, flow: flow)
    } catch {
      await failed(error, job: pending, flow: flow)
    }
  }

  /// A kept change: SAM finds its pieces and the largest becomes the cut-out; its pieces stay with
  /// it, so the edge tools send that piece with the marks.
  private func cutChange(_ id: String, flow: CreateFlow) async {
    if flow.changeCuts[id] != nil {
      leave(to: id, flow: flow)
      return
    }
    guard flow.changes.contains(where: { $0.artwork.id == id }), let pending = pending(flow) else {
      error = String(localized: "Your art is missing. Go back and pick it again.")
      return
    }
    do {
      let res = try await app.api.cutout(artworkId: id)
      guard flow.finishJob(pending) else { return }
      var candidates = res.candidates
      var size = res.imageSize
      // The pieces are also on GET /artworks/{id} after the cutout (docs/api.md, round 2b step 9).
      if candidates.isEmpty || size?.isUsable != true, let detail = try? await app.api.artworkDetail(id: id) {
        if candidates.isEmpty { candidates = detail.candidates }
        if size?.isUsable != true { size = detail.imageSize }
      }
      recordChangeCut(id, res.artwork, candidates: candidates, size: size, flow: flow)
    } catch {
      await failed(error, job: pending, flow: flow)
    }
  }

  private func recordChangeCut(_ id: String, _ artwork: Artwork, candidates: [Candidate], size: ImageSize?, flow: CreateFlow) {
    let art = flow.changes.first(where: { $0.artwork.id == id })?.artwork
    var cut = artwork
    if cut.altText?.isEmpty ?? true { cut.altText = art?.altText }
    if cut.spokenDescription?.isEmpty ?? true { cut.spokenDescription = art?.spokenDescription }
    // The server cut out the largest piece, `candidates[0]`; the edge tools send it with the marks.
    flow.changeCuts[id] = Cut(artwork: cut, candidates: candidates, imageSize: size,
                              selected: candidates.first.map { [$0.id] } ?? [], box: nil)
    flow.updateChange(cut)
    leave(to: id, flow: flow)
  }

  /// A failed call: a lost answer is looked for on the server first (kept for Try again otherwise);
  /// nothing in the frame goes back to Adjust the area; anything else is shown here.
  private func failed(_ error: Error, job pending: PendingJob, flow: CreateFlow) async {
    if APIError.isCancellation(error) { return }
    if case APIError.transport = error {
      if await recover(flow) { return }
    } else {
      flow.finishJob(pending)
    }
    if isDetect, case APIError.server(422, "no_drawing_found", _) = error {
      flow.areaError = CleanupResult.errorMessage(for: error)
      if flow === app.flow, app.createPath.last == .makingCutout(job) { app.createPath.removeLast() }
      return
    }
    self.error = CleanupResult.errorMessage(for: error) ?? error.localizedDescription
  }

  /// The cut already made on the server (after a lost answer, or back in the app): applied once.
  @discardableResult
  private func recover(_ flow: CreateFlow) async -> Bool {
    guard let pending = flow.pendingJob, case .cut(let id, _, _) = pending.kind,
          case .cut(let detail)? = await CreateFlow.reconcile(pending, api: app.api),
          flow.finishJob(pending) else { return false }
    error = nil
    switch job {
    case .detect(let box):
      guard id == flow.photoArtwork?.id else { return false }
      flow.recordDetect(DetectResponse(artwork: detail.artwork, candidates: detail.candidates, imageSize: detail.imageSize), box: box)
      leave(to: id, flow: flow)
    case .change(let changeId):
      guard id == changeId else { return false }
      recordChangeCut(id, detail.artwork, candidates: detail.candidates, size: detail.imageSize, flow: flow)
    }
    return true
  }

  private func leave(to artworkId: String, flow: CreateFlow) {
    guard flow === app.flow, app.createPath.last == .makingCutout(job) else { return }
    app.replaceTop(with: .yourCutout(artworkId))
  }
}
