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
      media: .animation(resource: Tokens.Asset.stickerLoading, aspect: ThemeEffects.productLoadingAspect,
                        radius: ThemeEffects.artPreviewRadius, reduced: .firstFrame),
      error: error,
      retry: { error = nil; attempt += 1 }
    )
    .task(id: attempt) { await run() }
    .onChange(of: app.flow.resumeCount) { _, _ in
      let flow = app.flow
      Task { @MainActor in await recover(flow) }
    }
  }

  private func run() async {
    let flow = app.flow
    guard let artwork = flow.artwork, let type = flow.productType else {
      error = String(localized: "The design is missing. Go back and pick it again.")
      return
    }
    var job: PendingJob?
    do {
      switch flow.productPlan(for: artwork, type: type) {
      case .create:
        // One `clientRequestId` per attempt (round 3): Try again after a lost answer sends it again.
        let pending = flow.startJob(.product(artworkId: artwork.id, type: type), knownProductIds: flow.knownProductIds(of: artwork))
        job = pending
        let api = app.api
        let product = try await flow.inFlight {
          try await api.createProduct(artworkId: artwork.id, type: type, clientRequestId: pending.clientRequestId)
        }
        guard flow.finishJob(pending) else { return }
        flow.useProduct(product, madeFrom: artwork)
      case .reuse:
        // Back from Listing details and "Use this" again, same cut: the draft is reused.
        break
      case .refresh(let draft):
        // Re-cut: the server rebuilt the draft's print file and mockup; read them again.
        flow.useProduct(CreateFlow.refreshed(draft, in: try await app.api.myArtworks()), madeFrom: artwork)
      }
      leave(type: type, flow: flow)
    } catch {
      if APIError.isCancellation(error) { return }
      if case APIError.transport = error {
        if await recover(flow) { return }
      } else if let job {
        flow.finishJob(job)
      }
      self.error = error.localizedDescription
    }
  }

  /// Listing details as soon as the product exists (its picture shows there while the listing is written).
  private func leave(type: ProductType, flow: CreateFlow) {
    UIAccessibility.post(notification: .announcement,
                         argument: type == .tote ? String(localized: "Your tote bag is ready!") : String(localized: "Your sticker is ready!"))
    if flow === app.flow, app.createPath.last == .makingProduct { app.replaceTop(with: .listingDetails) }
  }

  /// The product already made on the server (after a lost answer, or back in the app): used once.
  @discardableResult
  private func recover(_ flow: CreateFlow) async -> Bool {
    guard let job = flow.pendingJob, case .product(let artworkId, let type) = job.kind,
          let artwork = flow.artwork, artwork.id == artworkId,
          case .product(let product)? = await CreateFlow.reconcile(job, api: app.api),
          flow.finishJob(job) else { return false }
    error = nil
    flow.useProduct(product, madeFrom: artwork)
    leave(type: type, flow: flow)
    return true
  }
}
