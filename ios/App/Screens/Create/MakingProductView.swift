import SwiftUI

/// Boards "Making your sticker" (`2014:733`) / "Making your tote bag" (`4038:4494`): the product is
/// made from the cut-out (`POST /products`: print file and mockup), with the sticker-loading
/// animation (still frame with Reduce Motion); no Back while busy. Listing details replaces this
/// screen, so Back skips it.
struct MakingProductView: View {
  @Environment(AppState.self) private var app
  @State private var error: String?
  @State private var attempt = 0

  private var isTote: Bool { app.flow.productType == .tote }

  var body: some View {
    LoadingScreen(
      title: isTote ? "Making your tote bag" : "Making your sticker",
      subtitle: isTote ? "Placing your art on the bag and getting it ready to print." : "Adding the white border and getting it ready to print.",
      detail: isTote ? "Making your tote bag. This can take up to a minute." : "Making your sticker. This can take up to a minute.",
      media: .animation(resource: Tokens.Asset.mascotMagnifier, aspect: ThemeEffects.productLoadingAspect,
                        radius: ThemeEffects.artPreviewRadius, reduced: .firstFrame),
      error: error,
      retry: { error = nil; attempt += 1 }
    )
    .task(id: attempt) { await run() }
  }

  private func run() async {
    let flow = app.flow
    guard let artwork = flow.artwork, let type = flow.productType else {
      error = String(localized: "The design is missing. Go back and pick it again.")
      return
    }
    do {
      flow.product = try await app.api.createProduct(artworkId: artwork.id, type: type)
      if app.createPath.last == .makingProduct { app.replaceTop(with: .listingDetails) }
    } catch is CancellationError {
      return
    } catch {
      if APIError.isCancellation(error) { return }
      self.error = error.localizedDescription
    }
  }
}
