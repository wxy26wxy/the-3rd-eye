import SwiftUI

/// One saved design: large preview, status, and what can be done with it: make a sticker or a
/// tote (on to Listing details), edit a listing, re-do the cutout, see it in the shop, delete.
struct DesignDetailView: View {
  let artworkId: String
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var deleting: Artwork?
  @State private var editing: ArtworkProduct?
  @State private var shopPage: SheetURL?
  @State private var openingRedo = false
  @State private var removing = false
  /// "Make a sticker / tote" waiting for a confirmation (second product, or a creation in progress).
  @State private var pending: ContinueRequest?
  @State private var error: String?

  private var artwork: Artwork? { app.designs.artwork(id: artworkId) }

  var body: some View {
    FlowScreen(title: "Your design") {
      if let artwork {
        content(artwork)
      } else {
        Text("This design is no longer in My designs.")
          .themeFont(.bodyL)
          .foregroundStyle(colors.text)
          .multilineTextAlignment(.center)
      }
    } actions: {
      if let artwork {
        actions(artwork).disabled(openingRedo || removing)
      }
    }
    .sheet(item: $editing) { product in
      EditListingSheet(product: product)
    }
    .sheet(item: $shopPage) { page in
      SafariView(url: page.url).ignoresSafeArea()
    }
    .deleteDesignConfirmation(item: $deleting) { artwork in await delete(artwork) }
    .continueConfirmation($pending, app: app)
    .onDisappear {
      // Popped back to the grid: the re-cut notice has been seen.
      if !app.designsPath.contains(.detail(artworkId)), app.designFlow.photoArtwork?.id == artworkId {
        app.designFlow.cutoutNotice = nil
      }
    }
  }

  // MARK: Content

  private func content(_ artwork: Artwork) -> some View {
    let badge = DesignBadge.of(artwork)
    return VStack(spacing: Theme.Space.l) {
      DesignPicture(artwork: artwork, badge: badge)
        .frame(maxHeight: ThemeEffects.artworkMaxHeight)
        .frame(maxWidth: .infinity)
        // Without an image the placeholder only repeats the badge below it.
        .accessibilityHidden(artwork.displayURL == nil)
      DesignBadgeView(badge: badge)
      if let explanation = explanation(for: badge) {
        Text(explanation)
          .themeFont(.body)
          .foregroundStyle(colors.text)
          .multilineTextAlignment(.center)
      }
      ForEach(artwork.liveProducts) { product in productRow(product) }
      if let notice = cutoutNotice {
        Text(notice)
          .themeFont(.body)
          .foregroundStyle(colors.text)
          .multilineTextAlignment(.center)
      }
      if let error { ErrorCard(message: error) }
    }
  }

  private func explanation(for badge: DesignBadge) -> LocalizedStringKey? {
    switch badge {
    case .failed: return "This one didn't work. Re-do the cutout, or delete it."
    case .needsCutout: return "No cutout yet. Tap Re-do the cutout and pick your art."
    case .cuttingOut: return "Still cutting it out. If it stays like this, tap Re-do the cutout."
    case .draft, .inShop: return nil
    }
  }

  private func productRow(_ product: ArtworkProduct) -> some View {
    HStack(spacing: Theme.Space.m) {
      Image(systemName: product.type == .tote ? "bag" : "seal")
        .font(TextRole.titleM.font)
        .foregroundStyle(colors.text)
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: Theme.Space.xs) {
        Text(product.type == .tote ? "Tote bag" : "Sticker").themeFont(.titleM).foregroundStyle(colors.text)
        if let title = product.title, product.hasListing {
          Text(title).themeFont(.body).foregroundStyle(colors.text)
        }
      }
      Spacer(minLength: 0)
      DesignBadgeView(badge: product.isPublished ? .inShop : .draft)
    }
    .padding(Theme.Space.m)
    .frame(maxWidth: .infinity, minHeight: Theme.Size.iconButton)
    .background(RoundedRectangle(cornerRadius: Theme.Radius.m).fill(colors.surfaceAlt))
    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.thin))
    .accessibilityElement(children: .combine)
  }

  /// Shown after Re-do the cutout when a product could not be rebuilt or went back to draft.
  private var cutoutNotice: String? {
    app.designFlow.photoArtwork?.id == artworkId ? app.designFlow.cutoutNotice : nil
  }

  // MARK: Actions

  /// Shop and listing first (what a creator with a live design most often wants), then new
  /// products, the cutout, and Delete.
  @ViewBuilder private func actions(_ artwork: Artwork) -> some View {
    let products = artwork.liveProducts
    let published = products.filter(\.isPublished)
    ForEach(published) { product in
      PillButton(published.count == 1 ? "See it in the shop" : (product.type == .tote ? "See the tote in the shop" : "See the sticker in the shop"),
                 hint: "Opens the shop page buyers see") {
        shopPage = SheetURL(url: AppConfig.productPageURL(productId: product.id))
      }
    }
    let listed = products.filter(\.hasListing)
    ForEach(listed) { product in
      PillButton(listed.count == 1 ? "Edit listing" : (product.type == .tote ? "Edit the tote listing" : "Edit the sticker listing"),
                 hint: product.isPublished ? "Change the name, description or price" : "Finish the listing and put it in the shop",
                 kind: .secondary, showsArrow: false) {
        editListing(product, of: artwork)
      }
    }
    if artwork.isReadyForProducts {
      makeButton(.sticker, artwork: artwork)
      makeButton(.tote, artwork: artwork)
    }
    PillButton(openingRedo ? "Opening your photo…" : "Re-do the cutout", hint: "Pick other pieces or change the cutout", kind: .secondary, showsArrow: false) {
      Task { await openRedo(artwork) }
    }
    PillButton(removing ? "Deleting…" : "Delete", hint: "Asks before deleting this design", kind: .secondary, showsArrow: false) {
      deleting = artwork
    }
  }

  /// "Make a sticker", or "Make another sticker" (with a confirmation) when one is already in the
  /// shop. Either asks first when the Create tab has a creation in progress.
  @ViewBuilder private func makeButton(_ type: ProductType, artwork: Artwork) -> some View {
    if artwork.hasPublished(type) {
      PillButton(type == .tote ? "Make another tote" : "Make another sticker",
                 hint: hasDraft(type, in: artwork)
                   ? (type == .tote ? "Goes on to your tote draft" : "Goes on to your sticker draft")
                   : (type == .tote ? "You already have this tote in the shop" : "You already have this sticker in the shop"),
                 kind: .secondary, showsArrow: false) {
        go(artwork, type)
      }
    } else if type == .tote {
      PillButton("Make a tote", hint: hasDraft(.tote, in: artwork) ? "Goes on to your tote draft" : "Puts it on a tote bag and writes its listing") {
        go(artwork, .tote)
      }
    } else {
      PillButton("Make a sticker", hint: hasDraft(.sticker, in: artwork) ? "Goes on to your sticker draft" : "Makes a sticker and writes its listing") {
        go(artwork, .sticker)
      }
    }
  }

  /// On to Listing details, or the confirmation first.
  private func go(_ artwork: Artwork, _ type: ProductType) {
    pending = app.requestContinue(artwork: artwork, productType: type)
  }

  /// A published listing is edited in the sheet; a draft goes through Listing details, the
  /// normal way to publish (story video, You're live).
  private func editListing(_ product: ArtworkProduct, of artwork: Artwork) {
    if product.isPublished {
      editing = product
    } else if let type = product.type {
      go(artwork, type)
    }
  }

  private func hasDraft(_ type: ProductType, in artwork: Artwork) -> Bool {
    artwork.liveProducts.contains { $0.type == type && !$0.isPublished }
  }

  /// Loads the original and its pieces into the My designs flow, then opens Adjust cutout.
  private func openRedo(_ artwork: Artwork) async {
    openingRedo = true
    error = nil
    defer { openingRedo = false }
    do {
      let detail = try await app.api.artworkDetail(id: artwork.id)
      guard let size = detail.imageSize, size.isUsable, detail.originalUrl != nil else {
        error = String(localized: "This design has no photo to cut out again.")
        return
      }
      let flow = CreateFlow()
      flow.photoArtwork = detail.artwork
      flow.artwork = detail.artwork
      // Like a new photo: a single piece starts selected, so "Use this" without changes cuts nothing.
      flow.resetCutout(candidates: detail.candidates, imageSize: size)
      flow.productType = artwork.liveProducts.first?.type
      app.designFlow = flow
      if app.designsPath.last == .detail(artworkId) { app.designsPath.append(.redoCutout) }
    } catch {
      if APIError.isCancellation(error) { return }
      if case APIError.server(404, _, _) = error { Task { await app.designs.load() } }
      self.error = error.localizedDescription
    }
  }

  private func delete(_ artwork: Artwork) async {
    error = nil
    removing = true
    defer { removing = false }
    do {
      try await app.designs.delete(id: artwork.id)
      UIAccessibility.post(notification: .announcement, argument: String(localized: "Design deleted"))
      if app.designsPath.last == .detail(artworkId) { app.designsPath.removeLast() }
    } catch {
      if APIError.isCancellation(error) { return }
      self.error = error.localizedDescription
    }
  }
}
