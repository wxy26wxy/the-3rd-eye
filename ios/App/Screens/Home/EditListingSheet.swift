import SwiftUI

/// Edit a published listing from My designs: name, description, price. Saving sends
/// `POST /listings/{id}/approve` with `edits`; the server checks the words again before they go live.
/// Name, description and price start from the `GET /artworks` product summary. The price is always
/// sent: when the server did not send the live price the creator types it (an omitted price could
/// fall back to the agent's suggestion on older servers). Emptying a prefilled description clears it
/// (`""` is sent; the server keeps the saved text only when the field is omitted). When the server
/// did not send the description (older server), an empty field is omitted and the saved text stays.
/// Drafts do not use this sheet; they go through Listing details (story video, You're live).
struct EditListingSheet: View {
  /// Server limits on `approve` edits.
  static let minPriceCents = 100
  static let maxPriceCents = 100_000
  static let maxTitleLength = 80

  let product: ArtworkProduct
  @Environment(AppState.self) private var app
  @Environment(\.dismiss) private var dismiss
  @Environment(\.themeColors) private var colors
  @State private var title: String
  @State private var description: String
  @State private var priceText: String
  @State private var saving = false
  @State private var error: String?

  init(product: ArtworkProduct) {
    self.product = product
    _title = State(initialValue: product.title ?? "")
    _description = State(initialValue: product.description ?? "")
    _priceText = State(initialValue: product.priceCents.map { String(format: "%.2f", Double($0) / 100) } ?? "")
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: Theme.Space.l) {
        Text(product.type == .tote ? "Edit the tote listing" : "Edit the sticker listing")
          .themeFont(.titleL)
          .foregroundStyle(colors.text)
          .accessibilityAddTraits(.isHeader)
        LabeledTextField(label: "Name", text: $title, prompt: "Happy Frog Sticker")
        LabeledTextField(label: "Description", text: $description,
                         prompt: product.description == nil ? "Leave empty to keep it" : "A few words about it", axis: .vertical)
        LabeledTextField(label: "Price in dollars", text: $priceText, prompt: "5.00", keyboard: .decimalPad)
        Text("Your changes are checked again before they go live.")
          .themeFont(.bodyS)
          .foregroundStyle(colors.textMuted)
        if let error { ErrorCard(message: error) }
        PillButton(saving ? "Saving…" : "Save changes", hint: "Updates the listing in the shop") {
          Task { await save() }
        }
        .disabled(saving)
        SlowWorkHint(active: saving)
        PillButton("Cancel", hint: "Keeps the listing as it is", kind: .secondary, showsArrow: false) { dismiss() }
          .disabled(saving)
      }
      .padding(Theme.Space.page)
    }
    .background(colors.surface.ignoresSafeArea())
    .interactiveDismissDisabled(saving)
  }

  private func save() async {
    let name = title.trimmingCharacters(in: .whitespacesAndNewlines)
    let words = description.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !name.isEmpty else { return fail(String(localized: "Add a name first.")) }
    guard name.count <= Self.maxTitleLength else { return fail(String(localized: "Keep the name to 80 letters or fewer.")) }
    guard let cents = Money.cents(from: priceText), (Self.minPriceCents...Self.maxPriceCents).contains(cents) else {
      return fail(String(localized: "Enter a price between $1.00 and $1,000.00, like 5.00."))
    }
    saving = true
    error = nil
    defer { saving = false }
    do {
      let edits = ListingEdits(title: name, description: Self.descriptionEdit(words, saved: product.description), priceCents: cents)
      let res = try await app.api.approveListing(productId: product.id, via: "tap", edits: edits)
      app.designs.listingSaved(productId: product.id, title: res.listing.title ?? name, status: res.product.status,
                               priceCents: res.product.priceCents ?? cents, description: res.listing.description ?? edits.description)
      UIAccessibility.post(notification: .announcement, argument: String(localized: "Listing saved"))
      dismiss()
    } catch {
      if APIError.isCancellation(error) { return }
      if case APIError.server(409, "product_archived", _) = error { Task { await app.designs.load() } }
      fail(APIError.approveMessage(for: error))
    }
  }

  /// The `edits.description` to send: the typed text; `""` to clear a saved description the field
  /// was prefilled with; nil (omitted, keeps the saved text) when there was nothing to prefill.
  static func descriptionEdit(_ typed: String, saved: String?) -> String? {
    let words = typed.trimmingCharacters(in: .whitespacesAndNewlines)
    if !words.isEmpty { return words }
    let hadSaved = !(saved ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    return hadSaved ? "" : nil
  }

  private func fail(_ message: String) {
    error = message
    UIAccessibility.post(notification: .announcement, argument: message)
  }
}
