import SwiftUI

/// Board "Making your cutout" (`4030:4482`). Two jobs: the frame from Adjust the area (round 4:
/// the local photo is cropped to the frame, only the crop is uploaded and `POST /artworks {framed:
/// true}` finds the drawings in it and cuts out the largest, with the searching mascot), or a kept
/// change is cut out (`POST /artworks/{id}/cutout`, once per
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

  private var isDetect: Bool { if case .area = job { return true } else { return false } }

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
      // Review I5: back on screen after a tab switch, the job may be done already (or this screen
      // is no longer the top one): never send it a second time.
      guard !running, error == nil, app.createPath.last == .makingCutout(job) else { return }
      if Self.isDone(job, in: app.flow) {
        leave(to: Self.target(of: job, in: app.flow), flow: app.flow)
        return
      }
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
    case .area(let box): await cutArea(box, flow: flow)
    case .change(let id): await cutChange(id, flow: flow)
    }
  }

  /// The flow already has this job's cut: the frame's piece, or the change's cut-out.
  static func isDone(_ job: CutJob, in flow: CreateFlow) -> Bool {
    switch job {
    case .area(let box): return flow.cropBox == box && flow.pieceArtwork?.cleanedUrl != nil
    case .change(let id): return flow.changeCuts[id] != nil
    }
  }

  static func target(of job: CutJob, in flow: CreateFlow) -> String {
    switch job {
    case .area: return flow.photoArtwork?.id ?? ""
    case .change(let id): return id
    }
  }

  private func pending(_ flow: CreateFlow) -> PendingJob? {
    switch job {
    case .area(let box):
      var known = Set(app.designs.artworks.map(\.id))
      if let photo = flow.photoArtwork { known.insert(photo.id) }
      return flow.startJob(.photo(box: box), knownArtworkIds: known)
    case .change(let id):
      return flow.startJob(.cut(artworkId: id, previousCut: nil, needsCandidates: false))
    }
  }

  /// The frame on the local photo (round 4): the photo cropped to it (orientation applied first),
  /// the crop uploaded (once per frame: Try again reuses it), then `POST /artworks {framed: true}`:
  /// a new row whose largest drawing is cut out. The changes made from an earlier crop go.
  private func cutArea(_ box: [Double], flow: CreateFlow) async {
    guard let photo = flow.photo, let product = flow.productType, let pending = pending(flow) else {
      error = String(localized: "The photo is missing. Go back and take it again.")
      return
    }
    do {
      let url: String
      if let upload = flow.cropUpload, upload.box == box {
        url = upload.url
      } else {
        guard let crop = ImageTools.crop(photo, to: box), let data = ImageTools.jpeg(crop, quality: 0.92) else {
          flow.finishJob(pending)
          error = String(localized: "The photo is missing. Go back and take it again.")
          return
        }
        if app.creator == nil { await app.refreshCreator() }
        guard let creatorId = app.creator?.id else { throw APIError.unauthorized }
        let api = app.api
        let uploaded = try await flow.inFlight {
          try await BackgroundWork.run("photo-upload") {
            try await BlobUploader(api: api).upload(data, creatorId: creatorId, kind: .photo, contentType: "image/jpeg", fileExtension: "jpg")
          }
        }
        flow.cropUpload = CropUpload(box: box, url: uploaded.url)
        url = uploaded.url
      }
      let api = app.api
      let res = try await flow.inFlight { try await api.artworkFromPhoto(imageUrl: url, product: product, framed: true) }
      guard flow.finishJob(pending) else { return }
      flow.recordPhoto(res, box: box)
      guard res.artwork.cleanedUrl != nil else {
        nothingFound(flow, message: nil)
        return
      }
      leave(to: res.artwork.id, flow: flow)
    } catch let none as NoDrawingFound {
      // The row stays as an unused draft (no delete call); back to the frame with the advice.
      flow.finishJob(pending)
      _ = none
      nothingFound(flow, message: nil)
    } catch {
      await failed(error, job: pending, flow: flow)
    }
  }

  /// Nothing in the crop: back to Adjust the area, which says to move or grow the frame.
  private func nothingFound(_ flow: CreateFlow, message: String?) {
    flow.areaError = message ?? String(localized: "We couldn't find a drawing in that area. Make the frame bigger or move it over your drawing, then try again.")
    if flow === app.flow, app.createPath.last == .makingCutout(job) { app.createPath.removeLast() }
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
      let api = app.api
      let res = try await flow.inFlight { try await api.cutout(artworkId: id) }
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
      nothingFound(flow, message: CleanupResult.errorMessage(for: error))
      return
    }
    // A change's cutout shows the server's reason (T131); the frame's own 422 line is for `detect`.
    self.error = isDetect ? (CleanupResult.errorMessage(for: error) ?? error.localizedDescription) : error.localizedDescription
  }

  /// The cut already made on the server (after a lost answer, or back in the app): applied once.
  @discardableResult
  private func recover(_ flow: CreateFlow) async -> Bool {
    guard let pending = flow.pendingJob else { return false }
    switch (job, pending.kind) {
    case (.area(let box), .photo(let jobBox)) where box == jobBox:
      guard case .photo(let detail)? = await CreateFlow.reconcile(pending, api: app.api), flow.finishJob(pending) else { return false }
      error = nil
      flow.recordPhoto(PhotoArtworkResponse(artwork: detail.artwork, candidates: detail.candidates, imageSize: detail.imageSize), box: box)
      if detail.artwork.cleanedUrl == nil { nothingFound(flow, message: nil) } else { leave(to: detail.artwork.id, flow: flow) }
      return true
    case (.change(let changeId), .cut(let id, _, _)) where id == changeId:
      guard case .cut(let detail)? = await CreateFlow.reconcile(pending, api: app.api), flow.finishJob(pending) else { return false }
      error = nil
      recordChangeCut(id, detail.artwork, candidates: detail.candidates, size: detail.imageSize, flow: flow)
      return true
    default:
      return false
    }
  }

  private func leave(to artworkId: String, flow: CreateFlow) {
    guard flow === app.flow, app.createPath.last == .makingCutout(job) else { return }
    app.replaceTop(with: .yourCutout(artworkId))
  }
}
