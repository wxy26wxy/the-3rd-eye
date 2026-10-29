import SwiftUI

/// Board "You're live": the product is in the shop.
struct YoureLiveView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var preview: SheetURL?

  var body: some View {
    FlowScreen(title: "You're live!", subtitle: "Your art is in the shop. We'll tell you when someone buys it.", showsBack: false) {
      VStack(spacing: Theme.Space.l) {
        TagMascot(pose: .cheering)
        if let product = app.flow.product {
          RemoteImage(url: product.mockupUrl.flatMap(URL.init(string:)) ?? app.flow.artwork?.displayURL, altText: app.flow.artwork?.altText)
            .frame(maxHeight: ThemeEffects.artworkMaxHeight)
          if let price = product.priceCents {
            Text("You earn \(Money.format(cents: Money.creatorShareCents(priceCents: price, split: app.split))) per sale")
              .themeFont(.titleM)
              .foregroundStyle(colors.text)
          }
        }
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
    .onAppear { app.speech.speak(String(localized: "You're live! Your art is in the shop.")) }
  }
}
