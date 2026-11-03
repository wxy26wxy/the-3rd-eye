import SwiftUI

/// Board "Changing your art" (`2012:276`, error `2012:307`), round 4 ruling 2: one screen, three
/// calls in turn, each with its status line: "Changing your art…" (`POST /artworks/{id}/change`, a
/// new child row) → "Cutting it out…" (`POST /artworks/{child}/cutout`) → "Making your sticker…"
/// (`POST /products` for the child). Then Before and after (the two product photos) replaces this
/// screen, so Back skips it. The art ("YOUR ART") and the "YOU ASKED" card stay on screen; on error
/// Try again (from the step that failed) / Back to my art.
///
/// Each step is kept in the flow as it lands (`changeInProgress`, `changeCuts`, `products`), so Try
/// again or a return to the app goes on from the first step not done. A lost answer is looked for on
/// the server first (`CreateFlow.reconcile`: the change by its `clientRequestId`, the cut on
/// `GET /artworks/{child}`, the product by asking again with the same id), never while a call is
/// still waiting.
struct ChangingView: View {
  enum Step: Int { case change, cutout, product }

  @Environment(AppState.self) private var app
  @State private var error: String?
  @State private var attempt = 0
  @State private var step: Step = .change
  @State private var running = false

  private var isTote: Bool { app.flow.productType == .tote }

  private var detail: LocalizedStringResource {
    switch step {
    case .change: return "Changing your art…"
    case .cutout: return "Cutting it out…"
    case .product: return isTote ? "Making your tote bag…" : "Making your sticker…"
    }
  }

  var body: some View {
    LoadingScreen(
      title: "Changing your art",
      detail: detail,
      media: .art(app.flow.currentArt, photo: nil),
      spoken: app.flow.changeInstruction,
      error: error,
      retry: { error = nil; attempt += 1 },
      backLabel: "Back to my art"
    )
    .onChange(of: step) { _, _ in
      UIAccessibility.post(notification: .announcement, argument: String(localized: detail))
    }
    .task(id: attempt) {
      guard !running, error == nil, app.createPath.last == .changing else { return }
      running = true
      let flow = app.flow
      // Its own task: leaving the tab does not cancel the calls (the server finishes them anyway).
      await Task { @MainActor in await run(flow) }.value
      running = false
    }
    .onChange(of: app.flow.resumeCount) { _, _ in
      let flow = app.flow
      Task { @MainActor in
        guard !running else { return }
        if await recover(flow) {
          error = nil
          attempt += 1
        }
      }
    }
  }

  // MARK: Steps

  /// From the first step not done: the change, its cut-out, its product; then Before and after.
  private func run(_ flow: CreateFlow) async {
    guard let base = flow.currentArt, !flow.changeInstruction.isEmpty, let type = flow.productType else {
      error = String(localized: "Your art is missing. Go back and pick it again.")
      return
    }
    let instruction = flow.changeInstruction
    do {
      let pending: ChangeStep
      if let made = flow.changeInProgress, made.base.id == base.id, made.instruction == instruction {
        pending = made
      } else {
        step = .change
        guard let made = try await change(base: base, instruction: instruction, flow: flow) else { return }
        pending = made
      }
      let childId = pending.artwork.id
      if flow.changeCuts[childId] == nil {
        step = .cutout
        guard try await cutout(childId, flow: flow) else { return }
      }
      guard let cut = flow.changeCuts[childId]?.artwork else { return }
      if flow.readyProduct(for: cut) == nil {
        step = .product
        _ = try await flow.makeProduct(for: cut, type: type, api: app.api)
      }
      finish(flow)
    } catch {
      if APIError.isCancellation(error) { return }
      if case APIError.transport = error, await recover(flow) {
        await run(flow)
        return
      }
      self.error = error.localizedDescription
    }
  }

  /// Step 1: one `clientRequestId` per "Make the change" (round 3 ruling 6): Try again after a lost
  /// answer sends the same one, so the server answers the change it already made.
  private func change(base: Artwork, instruction: String, flow: CreateFlow) async throws -> ChangeStep? {
    let job = flow.startJob(.change(baseId: base.id, instruction: instruction))
    do {
      let api = app.api
      let transcript = flow.changeTranscript
      let res = try await flow.inFlight {
        try await api.change(artworkId: base.id, instruction: instruction, transcript: transcript, clientRequestId: job.clientRequestId)
      }
      guard flow.finishJob(job) else { return flow.changeInProgress }
      return record(res, base: base, instruction: instruction, flow: flow)
    } catch {
      if case APIError.transport = error {} else if !APIError.isCancellation(error) { flow.finishJob(job) }
      throw error
    }
  }

  /// Step 2: the child's cut-out (`cutout`; its pieces and size, also on `GET /artworks/{id}`).
  private func cutout(_ id: String, flow: CreateFlow) async throws -> Bool {
    let job = flow.startJob(.cut(artworkId: id, previousCut: nil, needsCandidates: false))
    do {
      let api = app.api
      let res = try await flow.inFlight { try await api.cutout(artworkId: id) }
      guard flow.finishJob(job) else { return flow.changeCuts[id] != nil }
      var candidates = res.candidates
      var size = res.imageSize
      if candidates.isEmpty || size?.isUsable != true, let detail = try? await app.api.artworkDetail(id: id) {
        if candidates.isEmpty { candidates = detail.candidates }
        if size?.isUsable != true { size = detail.imageSize }
      }
      flow.recordChangeCut(id, res.artwork, candidates: candidates, size: size, art: flow.changeInProgress?.artwork)
      if let cut = flow.changeCuts[id]?.artwork, !res.products.isEmpty { flow.applyRebuilt(res.products, for: cut) }
      return true
    } catch {
      if case APIError.transport = error {} else if !APIError.isCancellation(error) { flow.finishJob(job) }
      throw error
    }
  }

  /// The change answer, kept as the change in progress (not in the chain until its product exists).
  private func record(_ res: ChangeResponse, base: Artwork, instruction: String, flow: CreateFlow) -> ChangeStep {
    var changed = res.artwork
    // The description may come only in `description` (docs/api.md): keep it on the artwork.
    if changed.altText?.isEmpty ?? true { changed.altText = res.description?.alt }
    if changed.spokenDescription?.isEmpty ?? true { changed.spokenDescription = res.description?.spoken }
    // A repeated request (round 3) may answer before the change is described (`alt` / `spoken`
    // empty): the screen's own words instead.
    changed = Self.withFallbackCopy(changed)
    let made = ChangeStep(artwork: changed, base: base, instruction: instruction,
                          differences: res.description?.differences ?? changed.differencesFromPrompt)
    flow.changeInProgress = made
    return made
  }

  /// All three done: the change joins the chain and goes on screen; Before and after.
  private func finish(_ flow: CreateFlow) {
    guard let made = flow.changeInProgress else { return }
    flow.changeInProgress = nil
    flow.addChange(made)
    if let cut = flow.changeCuts[made.artwork.id]?.artwork { flow.updateChange(cut) }
    if flow === app.flow, app.createPath.last == .changing { app.replaceTop(with: .beforeAfter) }
  }

  /// Empty words become none, so Before and after keeps its own labels ("After") and shows no
  /// description card.
  static func withFallbackCopy(_ artwork: Artwork) -> Artwork {
    var art = artwork
    func blank(_ text: String?) -> Bool { (text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    if blank(art.altText) { art.altText = nil }
    if blank(art.spokenDescription) { art.spokenDescription = nil }
    return art
  }

  /// The step's result already on the server (after a lost answer, or back in the app), recorded
  /// once; the caller goes on with the next step.
  private func recover(_ flow: CreateFlow) async -> Bool {
    guard let job = flow.pendingJob else { return false }
    switch job.kind {
    case .change(let baseId, let instruction):
      guard let base = flow.currentArt, base.id == baseId,
            case .change(let res)? = await CreateFlow.reconcile(job, api: app.api),
            flow.finishJob(job) else { return false }
      _ = record(res, base: base, instruction: instruction, flow: flow)
      return true
    case .cut(let id, _, _):
      guard flow.changeInProgress?.artwork.id == id,
            case .cut(let detail)? = await CreateFlow.reconcile(job, api: app.api),
            flow.finishJob(job) else { return false }
      flow.recordChangeCut(id, detail.artwork, candidates: detail.candidates, size: detail.imageSize, art: flow.changeInProgress?.artwork)
      return true
    case .product:
      return await flow.recoverProduct(api: app.api) != nil
    default:
      return false
    }
  }
}
