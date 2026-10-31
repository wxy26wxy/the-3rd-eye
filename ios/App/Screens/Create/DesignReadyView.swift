import SwiftUI

/// Board "Sticker ready · Cloud studio" (`21:4509`): centred headline, the new sticker in the middle,
/// "Put it up for sale now?" with a line about My designs, then Yes, list it! / Not now.
struct DesignReadyView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors

  private var isTote: Bool { app.flow.productType == .tote }

  var body: some View {
    FlowScreen(title: isTote ? "Your tote bag is ready!" : "Your sticker is ready!", titleAlignment: .center) {
      VStack(spacing: Theme.Space.l) {
        StickerCard(url: app.flow.artwork?.displayURL, altText: app.flow.artwork?.altText, size: ThemeEffects.readySticker)
          .frame(maxWidth: .infinity)
        if let artwork = app.flow.artwork, app.flow.photoArtwork?.id == artwork.id {
          Button { app.push(.adjustCutout) } label: {
            Text("Adjust cutout")
              .themeFont(.body)
              .underline()
              .foregroundStyle(colors.text)
              .frame(minWidth: Theme.Size.minTarget, minHeight: Theme.Size.minTarget)
              .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .accessibilityHint(Text("Pick other pieces or change the cutout"))
        }
        if let notice = app.flow.cutoutNotice {
          Text(notice)
            .themeFont(.body)
            .foregroundStyle(colors.text)
            .multilineTextAlignment(.center)
        }
        VStack(alignment: .leading, spacing: Theme.Space.s) {
          Text("Put it up for sale now?")
            .themeFont(.displayM)
            .foregroundStyle(colors.text)
            .accessibilityAddTraits(.isHeader)
          Text("People can buy it on \(Tokens.Brand.name). It's also saved in My designs, so you can list it later too.")
            .themeFont(.body)
            .foregroundStyle(colors.textMuted)
        }
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    } actions: {
      PillButton("Yes, list it!", hint: "Makes the product and writes the listing") {
        app.flow.product = nil
        app.push(.listingDetails)
      }
      PillButton("Not now", hint: "Keeps the design and goes to My designs", kind: .secondary, showsArrow: false) {
        app.startNewCreation()
        app.selectedTab = .designs
      }
    }
    .announces(isTote ? String(localized: "Your tote bag is ready! Put it up for sale now?")
                      : String(localized: "Your sticker is ready! Put it up for sale now?"))
  }
}
