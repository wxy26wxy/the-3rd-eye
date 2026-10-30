import SwiftUI

/// Edit a listing from My designs: name, description, price. Saving sends
/// `POST /listings/{id}/approve` with `edits`; the server checks the words again before they go live.
/// Only the name is known beforehand (`GET /artworks` carries the title), so an empty description or
/// price keeps what the listing has.
struct EditListingSheet: View {
  let product: ArtworkProduct
  @Environment(AppState.self) private var app
  @Environment(\.dismiss) private var dismiss
  @Environment(\.themeColors) private var colors
  @State private var title: String
  @State private var description = ""
  @State private var priceText = ""
  @State private var saving = false
  @State private var error: String?

  init(product: ArtworkProduct) {
    self.product = product
    _title = State(initialValue: product.title ?? "")
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: Theme.Space.l) {
        Text(product.type == .tote ? "Edit the tote listing" : "Edit the sticker listing")
          .themeFont(.titleL)
          .foregroundStyle(colors.text)
          .accessibilityAddTraits(.isHeader)
        LabeledTextField(label: "Name", text: $title, prompt: "Happy Frog Sticker")
        LabeledTextField(label: "Description", text: $description, prompt: "Leave empty to keep it", axis: .vertical)
        LabeledTextField(label: "Price in dollars", text: $priceText, prompt: "Leave empty to keep it", keyboard: .decimalPad)
        Text("Your changes are checked again before they go live.")
          .themeFont(.bodyS)
          .foregroundStyle(colors.textMuted)
        if let error { ErrorCard(message: error) }
        PillButton(saving ? "Saving…" : (product.isPublished ? "Save changes" : "Save and list it"),
                   hint: product.isPublished ? "Updates the listing in the shop" : "Puts it in the shop") {
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
    let price = priceText.trimmingCharacters(in: .whitespaces)
    var cents: Int?
    if !price.isEmpty {
      guard let parsed = Money.cents(from: price), parsed > 0 else {
        return fail(String(localized: "Enter a price like 5.00, or leave it empty."))
      }
      cents = parsed
    }
    guard !name.isEmpty else { return fail(String(localized: "Add a name first.")) }
    saving = true
    error = nil
    defer { saving = false }
    do {
      let edits = ListingEdits(title: name, description: words.isEmpty ? nil : words, priceCents: cents)
      let res = try await app.api.approveListing(productId: product.id, via: "tap", edits: edits)
      app.designs.listingSaved(productId: product.id, title: res.listing.title ?? name, status: res.product.status)
      UIAccessibility.post(notification: .announcement, argument: String(localized: "Listing saved"))
      dismiss()
    } catch {
      if APIError.isCancellation(error) { return }
      fail(error.localizedDescription)
    }
  }

  private func fail(_ message: String) {
    error = message
    UIAccessibility.post(notification: .announcement, argument: message)
  }
}
