import SwiftUI

/// Board "Listing details": name, price, You earn per sale; AI prefill; approve by tap.
struct ListingDetailsView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var title = ""
  @State private var description = ""
  @State private var priceText = ""
  @State private var creatingProduct = false
  @State private var improving = false
  @State private var approving = false
  @State private var autoRan = false
  @State private var error: String?

  private var priceCents: Int { Money.cents(from: priceText) ?? 0 }
  private var earnCents: Int { Money.creatorShareCents(priceCents: priceCents, split: app.split) }

  var body: some View {
    FlowScreen(title: "Listing details", subtitle: "Check the name and price, then list it.") {
      if creatingProduct {
        VStack(spacing: Theme.Space.l) {
          SkyCard(pose: .book)
          Text(app.flow.productType == .tote ? "Making your tote bag. This can take up to a minute." : "Making your sticker. This can take up to a minute.")
            .themeFont(.bodyL)
            .foregroundStyle(colors.text)
            .multilineTextAlignment(.center)
          ProgressView().tint(colors.text).accessibilityLabel(Text("Working"))
          SlowWorkHint()
        }
      } else {
        form
      }
    } actions: {
      if !creatingProduct && app.flow.product != nil {
        PillButton(approving ? "Listing it…" : "Approve and list it", hint: "Puts it in the shop") {
          Task { await approve(via: "tap") }
        }
        .disabled(approving || title.trimmingCharacters(in: .whitespaces).isEmpty || priceCents <= 0)
        if !approving && (title.trimmingCharacters(in: .whitespaces).isEmpty || priceCents <= 0) {
          Text("Add a name and a price to list it, or tap Improve with AI.")
            .themeFont(.bodyS)
            .foregroundStyle(colors.textMuted)
            .multilineTextAlignment(.center)
        }
        SlowWorkHint(active: approving)
      }
    }
    .task { await createProductIfNeeded() }
  }

  private var form: some View {
    VStack(alignment: .leading, spacing: Theme.Space.l) {
      if let product = app.flow.product {
        // The mockup on a grey card (board `2014:678`).
        RemoteImage(url: product.mockupUrl.flatMap(URL.init(string:)) ?? app.flow.artwork?.displayURL, altText: app.flow.artwork?.altText)
          .padding(Theme.Space.l)
          .frame(maxWidth: .infinity, maxHeight: ThemeEffects.mockupMaxHeight)
          .background(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous).fill(colors.surfaceAlt))
      }
      Button {
        Task { await improve() }
      } label: {
        Label(improving ? "Writing your listing…" : "Improve with AI", systemImage: "sparkles")
      }
      .buttonStyle(PillButtonStyle(kind: .secondary, showsArrow: false))
      .disabled(improving || app.flow.product == nil)
      .accessibilityHint(Text("Writes a name, description and price for you to check"))
      SlowWorkHint(active: improving)

      LabeledTextField(label: "Name", text: $title, prompt: "Happy Frog Sticker")
      LabeledTextField(label: "Description", text: $description, prompt: "A few words about it", axis: .vertical)
      LabeledTextField(label: "Price in dollars", text: $priceText, prompt: "5.00", keyboard: .decimalPad)

      Card(selected: true) {
        HStack {
          Text("You earn per sale").themeFont(.titleL).foregroundStyle(colors.accentInk)
          Spacer()
          Text(Money.format(cents: earnCents)).themeFont(.displayM).fontWeight(TextRole.titleL.weight).foregroundStyle(colors.accentInk)
        }
      }
      .accessibilityElement(children: .combine)

      if let error { ErrorCard(message: error) }
    }
  }

  private func createProductIfNeeded() async {
    if let product = app.flow.product {
      // A draft reused from My designs: show its listing title, or write one in simple mode.
      fill(from: product)
      if title.isEmpty, let saved = app.flow.productTitle { title = saved }
      if description.isEmpty, let saved = app.flow.productDescription { description = saved }
      if title.isEmpty, app.flow.productTitle == nil, app.prefs.simpleMode, !autoRan {
        autoRan = true
        await improve()
      }
      return
    }
    guard let artwork = app.flow.artwork, let type = app.flow.productType else {
      error = String(localized: "The design is missing. Go back and pick it again.")
      return
    }
    creatingProduct = true
    defer { creatingProduct = false }
    do {
      let product = try await app.api.createProduct(artworkId: artwork.id, type: type)
      app.flow.product = product
      fill(from: product)
      if app.prefs.simpleMode && !autoRan {
        autoRan = true
        creatingProduct = false
        await improve()
      }
    } catch is CancellationError {
      return
    } catch {
      self.error = error.localizedDescription
    }
  }

  private func fill(from product: Product?) {
    if priceText.isEmpty, let cents = product?.priceCents { priceText = String(format: "%.2f", Double(cents) / 100) }
  }

  private func improve() async {
    guard let product = app.flow.product else { return }
    improving = true
    error = nil
    defer { improving = false }
    do {
      let res = try await app.api.runListingAgent(productId: product.id)
      title = res.listing.title
      description = res.listing.description ?? description
      if let cents = res.listing.priceCents { priceText = String(format: "%.2f", Double(cents) / 100) }
      // The fields show all of this; VoiceOver hears the summary without visiting each one.
      UIAccessibility.post(notification: .announcement, argument: String(localized: "I wrote a listing called \(title), for \(Money.format(cents: priceCents)). You earn \(Money.format(cents: earnCents)) per sale. Check it, then tap Approve and list it."))
    } catch {
      self.error = error.localizedDescription
    }
  }

  private func approve(via: String) async {
    guard let product = app.flow.product else { return }
    guard !title.trimmingCharacters(in: .whitespaces).isEmpty, priceCents > 0 else {
      let message = String(localized: "Add a name and a price first, or tap Improve with AI.")
      error = message
      UIAccessibility.post(notification: .announcement, argument: message)
      return
    }
    approving = true
    error = nil
    defer { approving = false }
    do {
      let edits = ListingEdits(title: title, description: description.isEmpty ? nil : description, priceCents: priceCents)
      let res = try await app.api.approveListing(productId: product.id, via: via, edits: edits)
      app.flow.approval = res
      app.flow.product = res.product
      app.push(res.storyVideoNeeded ? .storyVideo : .youreLive)
    } catch {
      if APIError.isCancellation(error) { return }
      let message = APIError.approveMessage(for: error)
      self.error = message
      UIAccessibility.post(notification: .announcement, argument: message)
    }
  }
}
