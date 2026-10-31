import SwiftUI

/// "Make a sticker / tote" (or Edit listing on a draft) from My designs, waiting for a
/// confirmation: a product of that type is already in the shop, a draft of that type is reused,
/// or the Create tab has a creation in progress that `AppState.continueFrom` would replace.
struct ContinueRequest: Identifiable, Equatable {
  let artwork: Artwork
  let productType: ProductType
  /// A product of this type is already in the shop ("Make another …").
  let another: Bool
  /// A draft product of this type exists, so it is continued instead of making a new one.
  let reusesDraft: Bool
  /// The Create tab has a creation in progress, which going on replaces.
  let replacesCreation: Bool

  var id: String { "\(artwork.id)-\(productType.rawValue)" }

  /// nil when nothing needs asking (no second product, nothing in progress): go straight on.
  /// `editingDraft`: "Edit listing" on a draft row, where a product in the shop is no reason to
  /// ask (the creator chose that draft); only a creation in progress is.
  static func make(artwork: Artwork, productType: ProductType, creationInProgress: Bool,
                   editingDraft: Bool = false) -> ContinueRequest? {
    let another = !editingDraft && artwork.hasPublished(productType)
    guard another || creationInProgress else { return nil }
    let draft = artwork.liveProducts.contains { $0.type == productType && !$0.isPublished }
    return ContinueRequest(artwork: artwork, productType: productType, another: another,
                           reusesDraft: draft, replacesCreation: creationInProgress)
  }

  var title: LocalizedStringKey {
    if another { return productType == .tote ? "This tote is already in the shop" : "This sticker is already in the shop" }
    return "Replace the design you're making?"
  }

  var confirmLabel: LocalizedStringKey {
    // Not the detail button's own label ("Continue the sticker draft"), so each is found once.
    if another && reusesDraft { return "Yes, continue the draft" }
    if another { return productType == .tote ? "Make another tote" : "Make another sticker" }
    return "Replace it"
  }

  /// Whole sentences per case (no joined fragments, so word order can change in other languages).
  var message: LocalizedStringKey {
    switch (another, reusesDraft, replacesCreation, productType == .tote) {
    case (true, true, false, false):
      return "This continues your sticker draft; no new product is made. To change the one in the shop, use Edit listing."
    case (true, true, false, true):
      return "This continues your tote draft; no new product is made. To change the one in the shop, use Edit listing."
    case (true, true, true, false):
      return "This continues your sticker draft and replaces the design you're making in Create. To change the one in the shop, use Edit listing."
    case (true, true, true, true):
      return "This continues your tote draft and replaces the design you're making in Create. To change the one in the shop, use Edit listing."
    case (true, false, false, _):
      return "A second product gets its own listing. To change the one in the shop, use Edit listing."
    case (true, false, true, _):
      return "A second product gets its own listing, and it replaces the design you're making in Create. To change the one in the shop, use Edit listing."
    case (false, _, _, _):
      return "You have a design in progress in the Create tab. Going on replaces it."
    }
  }
}

extension AppState {
  /// The Create tab is somewhere in a creation that is not yet live.
  var hasCreationInProgress: Bool {
    !createPath.isEmpty && !createPath.contains(.youreLive)
  }

  /// "Make a sticker / tote" from My designs: goes straight on, or returns what to ask first.
  func requestContinue(artwork: Artwork, productType: ProductType, editingDraft: Bool = false) -> ContinueRequest? {
    guard let request = ContinueRequest.make(artwork: artwork, productType: productType,
                                             creationInProgress: hasCreationInProgress, editingDraft: editingDraft) else {
      continueFrom(artwork: artwork, productType: productType)
      return nil
    }
    return request
  }
}

extension View {
  /// Asks before `AppState.continueFrom` when `request` is set; the confirm button goes on.
  func continueConfirmation(_ request: Binding<ContinueRequest?>, app: AppState) -> some View {
    confirmationDialog(
      Text(request.wrappedValue?.title ?? ""),
      isPresented: Binding(get: { request.wrappedValue != nil }, set: { if !$0 { request.wrappedValue = nil } }),
      titleVisibility: .visible,
      presenting: request.wrappedValue
    ) { pending in
      Button(pending.confirmLabel) { app.continueFrom(artwork: pending.artwork, productType: pending.productType) }
      Button("Cancel", role: .cancel) {}
    } message: { pending in
      Text(pending.message)
    }
  }
}
