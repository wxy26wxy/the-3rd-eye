import SwiftUI

/// Board "You're live · Cloud studio" (`21:4554`): centred headline, the shop mascot (T122 R7; no
/// product card), "<title> is in the shop.", then Make another / See what buyers see.
struct YoureLiveView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var preview: SheetURL?

  private var listingTitle: String? {
    [app.flow.approval?.listing.title, app.flow.productTitle]
      .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
      .first { !$0.isEmpty }
  }

  private var isTote: Bool { (app.flow.product?.type ?? app.flow.productType) == .tote }

  var body: some View {
    FlowScreen(title: "You're live!", showsBack: false, titleAlignment: .center) {
      VStack(alignment: .leading, spacing: Theme.Space.xxl) {
        // T122 R7: the shop mascot; the product itself is one tap away ("See what buyers see").
        MascotPicture(asset: Tokens.Asset.mascotShop,
                      description: "Our green mascot points at a shop page full of stickers and tote bags.")
        VStack(alignment: .leading, spacing: Theme.Space.s) {
          Group {
            if let listingTitle {
              Text("\(listingTitle) is in the shop.")
            } else {
              Text("Your art is in the shop.")
            }
          }
          .themeFont(.displayM)
          .foregroundStyle(colors.text)
          Text(isTote ? "We'll tell you when someone buys it. Every tote bag ships with your story tag."
                      : "We'll tell you when someone buys it. Every sticker ships with your story tag.")
            .themeFont(.body)
            .foregroundStyle(colors.textMuted)
        }
        .fixedSize(horizontal: false, vertical: true)
      }
    } actions: {
      PillButton("Make another", hint: "Starts a new design") { app.startNewCreation() }
      if let product = app.flow.product {
        PillButton("See what buyers see", hint: "Opens your product page", kind: .secondary, showsArrow: false) {
          preview = SheetURL(url: AppConfig.productPageURL(productId: product.id))
        }
      }
    }
    .sheet(item: $preview) { SafariView(url: $0.url).ignoresSafeArea() }
    .announces(listingTitle.map { String(localized: "You're live! \($0) is in the shop.") }
               ?? String(localized: "You're live! Your art is in the shop."))
  }
}
