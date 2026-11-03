import SwiftUI

/// Board "Changing your art" (`2012:276`, error `2012:307`): Muse Image changes the art. The art
/// ("YOUR ART"), the "YOU ASKED" card, the message and a spinner; on error Try again / Back to my art.
/// The answer is a new child artwork; Before and after replaces this screen, so Back skips it.
struct ChangingView: View {
  @Environment(AppState.self) private var app
  @State private var error: String?
  @State private var attempt = 0

  var body: some View {
    LoadingScreen(
      title: "Changing your art",
      detail: "Changing your art now. This can take up to a minute.",
      media: .art(app.flow.currentArt, photo: app.flow.photo),
      spoken: app.flow.changeInstruction,
      error: error,
      retry: { error = nil; attempt += 1 },
      backLabel: "Back to my art"
    )
    .task(id: attempt) { await run() }
    .onChange(of: app.flow.resumeCount) { _, _ in
      let flow = app.flow
      Task { @MainActor in await recover(flow) }
    }
  }

  /// One `clientRequestId` per "Make the change" (round 3 ruling 6): Try again after a lost answer
  /// sends the same one, so the server answers the change it already made.
  private func run() async {
    let flow = app.flow
    guard let base = flow.currentArt, !flow.changeInstruction.isEmpty else {
      error = String(localized: "Your art is missing. Go back and pick it again.")
      return
    }
    let instruction = flow.changeInstruction
    let job = flow.startJob(.change(baseId: base.id, instruction: instruction))
    do {
      let res = try await app.api.change(artworkId: base.id, instruction: instruction, transcript: flow.changeTranscript,
                                         clientRequestId: job.clientRequestId)
      guard flow.finishJob(job) else { return }
      apply(res, base: base, instruction: instruction, flow: flow)
    } catch {
      if APIError.isCancellation(error) { return }
      if case APIError.transport = error {
        if await recover(flow) { return }
      } else {
        flow.finishJob(job)
      }
      self.error = error.localizedDescription
    }
  }

  private func apply(_ res: ChangeResponse, base: Artwork, instruction: String, flow: CreateFlow) {
    var changed = res.artwork
    // The description may come only in `description` (docs/api.md): keep it on the artwork.
    if changed.altText?.isEmpty ?? true { changed.altText = res.description?.alt }
    if changed.spokenDescription?.isEmpty ?? true { changed.spokenDescription = res.description?.spoken }
    flow.addChange(ChangeStep(artwork: changed, base: base, instruction: instruction,
                              differences: res.description?.differences ?? changed.differencesFromPrompt))
    if flow === app.flow, app.createPath.last == .changing { app.replaceTop(with: .beforeAfter) }
  }

  /// The change already made on the server (after a lost answer, or back in the app): applied once.
  @discardableResult
  private func recover(_ flow: CreateFlow) async -> Bool {
    guard let job = flow.pendingJob, case .change(let baseId, let instruction) = job.kind,
          let base = flow.currentArt, base.id == baseId,
          case .change(let res)? = await CreateFlow.reconcile(job, api: app.api),
          flow.finishJob(job) else { return false }
    error = nil
    apply(res, base: base, instruction: instruction, flow: flow)
    return true
  }
}
