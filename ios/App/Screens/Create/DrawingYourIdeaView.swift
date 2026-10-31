import SwiftUI

/// Loading: Muse Image draws the shaped prompt.
struct DrawingYourIdeaView: View {
  @Environment(AppState.self) private var app
  @State private var error: String?
  @State private var attempt = 0

  var body: some View {
    LoadingScreen(
      title: "Drawing your idea",
      detail: "Making your picture now. This can take up to a minute.",
      pose: .magnifier,
      spoken: app.flow.shaped?.spokenConfirmation,
      error: error,
      retry: { error = nil; attempt += 1 }
    )
    .task(id: attempt) { await run() }
  }

  private func run() async {
    guard let shaped = app.flow.shaped, let product = app.flow.productType else {
      error = String(localized: "Your idea is missing. Go back and say it again.")
      return
    }
    do {
      // Simple mode shows one picture; otherwise a few to choose from.
      let count = app.prefs.simpleMode ? 1 : 3
      let variants = try await app.api.generateArtworks(prompt: shaped.prompt, transcript: app.flow.transcript, product: product, n: count)
      guard !variants.isEmpty else { throw APIError.invalidResponse }
      app.flow.variants = variants
      app.flow.selectedVariant = 0
      app.replaceTop(with: .voiceResult)
    } catch is CancellationError {
      return
    } catch {
      self.error = error.localizedDescription
    }
  }
}
