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
  }

  private func run() async {
    let flow = app.flow
    guard let base = flow.currentArt, !flow.changeInstruction.isEmpty else {
      error = String(localized: "Your art is missing. Go back and pick it again.")
      return
    }
    do {
      let res = try await app.api.change(artworkId: base.id, instruction: flow.changeInstruction, transcript: flow.changeTranscript)
      var changed = res.artwork
      // The description may come only in `description` (docs/api.md): keep it on the artwork.
      if changed.altText?.isEmpty ?? true { changed.altText = res.description?.alt }
      if changed.spokenDescription?.isEmpty ?? true { changed.spokenDescription = res.description?.spoken }
      flow.changeBase = base
      flow.changedArtwork = changed
      flow.changeDifferences = res.description?.differences ?? changed.differencesFromPrompt
      if app.createPath.last == .changing { app.replaceTop(with: .beforeAfter) }
    } catch is CancellationError {
      return
    } catch {
      if APIError.isCancellation(error) { return }
      self.error = error.localizedDescription
    }
  }
}
