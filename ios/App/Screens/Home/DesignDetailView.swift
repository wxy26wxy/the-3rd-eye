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
    // Board `2016:1178`: one primary pinned in the bottom bar (T103 re-review R1, so it is on
    // screen at every text size); the other actions follow the content as secondary pills.
    FlowScreen(title: "Your design") {
      if let artwork {
        content(artwork)
        VStack(spacing: Theme.Space.s) {
          secondaryActions(artwork)
        }
        .disabled(openingRedo || removing)
      } else {
        Text("This design is no longer in My designs.")
          .themeFont(.bodyL)
          .foregroundStyle(colors.text)
          .multilineTextAlignment(.center)
      }
    } actions: {
      if let artwork {
        primaryAction(artwork).disabled(openingRedo || removing)
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
        .padding(Theme.Space.xl)
        .frame(maxWidth: .infinity, maxHeight: ThemeEffects.artworkMaxHeight)
        .background(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous).fill(colors.surfaceAlt))
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
      VStack(alignment: .leading, spacing: Theme.Space.xs) {
        Text(product.type == .tote ? "Tote bag" : "Sticker").themeFont(.titleL).foregroundStyle(colors.text)
        if let title = product.title, product.hasListing {
          Text(title).themeFont(.body).foregroundStyle(colors.text)
        }
      }
      Spacer(minLength: 0)
      DesignBadgeView(badge: product.isPublished ? .inShop : .draft)
    }
    .padding(Theme.Space.l)
    .frame(maxWidth: .infinity, minHeight: Theme.Size.iconButton)
    .background(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous).fill(colors.surface))
    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous).stroke(colors.border, lineWidth: Theme.Border.thin))
    .accessibilityElement(children: .combine)
  }

  /// Shown after Re-do the cutout when a product could not be rebuilt or went back to draft.
  private var cutoutNotice: String? {
    app.designFlow.cutoutArtwork?.id == artworkId ? app.designFlow.cutoutNotice : nil
  }

  // MARK: Actions

  private func primary(_ artwork: Artwork) -> DesignPrimaryAction? { DesignPrimaryAction.of(artwork) }

  @ViewBuilder private func primaryAction(_ artwork: Artwork) -> some View {
    let published = artwork.liveProducts.filter(\.isPublished)
    switch primary(artwork) {
    case .shop(let id):
      if let product = published.first(where: { $0.id == id }) { shopButton(product, count: published.count, kind: .primary) }
    case .make(let type):
      makeButton(type, artwork: artwork, kind: .primary)
    case .redo:
      redoButton(artwork, kind: .primary)
    case nil:
      EmptyView()
    }
  }

  /// Shop and listing first (what a creator with a live design most often wants), then new
  /// products, the cutout, and Delete (destructive style), all secondary.
  @ViewBuilder private func secondaryActions(_ artwork: Artwork) -> some View {
    let products = artwork.liveProducts
    let published = products.filter(\.isPublished)
    let pinned = primary(artwork)
    ForEach(published) { product in
      if pinned != .shop(product.id) { shopButton(product, count: published.count, kind: .secondary) }
    }
    let listed = products.filter(\.hasListing)
    ForEach(listed) { product in
      // With several listings each label is distinct (a draft and a live sticker can sit side by side).
      PillButton(listed.count == 1 ? "Edit listing"
                 : product.isPublished ? (product.type == .tote ? "Edit the tote listing" : "Edit the sticker listing")
                 : (product.type == .tote ? "Edit the tote draft" : "Edit the sticker draft"),
                 hint: product.isPublished ? "Change the name, description or price" : "Finish the listing and put it in the shop",
                 kind: .secondary, showsArrow: false) {
        editListing(product, of: artwork)
      }
    }
    if artwork.isReadyForProducts {
      if pinned != .make(.sticker) { makeButton(.sticker, artwork: artwork, kind: .secondary) }
      if pinned != .make(.tote) { makeButton(.tote, artwork: artwork, kind: .secondary) }
    }
    if pinned != .redo { redoButton(artwork, kind: .secondary) }
    PillButton(removing ? "Deleting…" : "Delete", hint: "Asks before deleting this design", kind: .destructive, showsArrow: false) {
      deleting = artwork
    }
  }

  private func redoButton(_ artwork: Artwork, kind: PillButtonStyle.Kind) -> some View {
    PillButton(openingRedo ? "Opening your photo…" : "Re-do the cutout", hint: "Fix the edges of the cutout",
               kind: kind, showsArrow: kind == .primary) {
      Task { await openRedo(artwork) }
    }
  }

  private func shopButton(_ product: ArtworkProduct, count: Int, kind: PillButtonStyle.Kind) -> some View {
    PillButton(count == 1 ? "See it in the shop" : (product.type == .tote ? "See the tote in the shop" : "See the sticker in the shop"),
               hint: "Opens the shop page buyers see", kind: kind, showsArrow: kind == .primary) {
      shopPage = SheetURL(url: AppConfig.productPageURL(productId: product.id))
    }
  }

  /// "Make a sticker", or "Make another sticker" (with a confirmation) when one is already in the
  /// shop; "Continue the sticker draft" when a draft of that type is there too (that is what
  /// happens). Each asks first when the Create tab has a creation in progress.
  @ViewBuilder private func makeButton(_ type: ProductType, artwork: Artwork, kind: PillButtonStyle.Kind) -> some View {
    if artwork.hasPublished(type) {
      let draft = hasDraft(type, in: artwork)
      PillButton(draft ? (type == .tote ? "Continue the tote draft" : "Continue the sticker draft")
                       : (type == .tote ? "Make another tote" : "Make another sticker"),
                 hint: draft
                   ? (type == .tote ? "Goes on to your tote draft" : "Goes on to your sticker draft")
                   : (type == .tote ? "You already have this tote in the shop" : "You already have this sticker in the shop"),
                 kind: kind, showsArrow: kind == .primary) {
        go(artwork, type)
      }
    } else if type == .tote {
      PillButton("Make a tote", hint: hasDraft(.tote, in: artwork) ? "Goes on to your tote draft" : "Puts it on a tote bag and writes its listing",
                 kind: kind, showsArrow: kind == .primary) {
        go(artwork, .tote)
      }
    } else {
      PillButton("Make a sticker", hint: hasDraft(.sticker, in: artwork) ? "Goes on to your sticker draft" : "Makes a sticker and writes its listing",
                 kind: kind, showsArrow: kind == .primary) {
        go(artwork, .sticker)
      }
    }
  }

  /// On to Listing details, or the confirmation first.
  private func go(_ artwork: Artwork, _ type: ProductType, editingDraft: Bool = false) {
    pending = app.requestContinue(artwork: artwork, productType: type, editingDraft: editingDraft)
  }

  /// A published listing is edited in the sheet; a draft goes through Listing details, the
  /// normal way to publish (story video, You're live).
  private func editListing(_ product: ArtworkProduct, of artwork: Artwork) {
    if product.isPublished {
      editing = product
    } else if let type = product.type {
      // Straight to the draft, even with a product of that type in the shop.
      go(artwork, type, editingDraft: true)
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
      flow.artwork = detail.artwork
      // A single piece starts selected, so "Use this" without changes cuts nothing.
      flow.resetCutout(artwork: detail.artwork, candidates: detail.candidates, imageSize: size)
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
