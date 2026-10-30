import SwiftUI

/// Board "Design ready": saved to My designs; offer to list it now.
struct DesignReadyView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors

  var body: some View {
    FlowScreen(title: "Your design is ready!", subtitle: "It's saved in My designs.") {
      VStack(spacing: Theme.Space.l) {
        TagMascot(pose: .cheering)
        if let artwork = app.flow.artwork {
          RemoteImage(url: artwork.displayURL, altText: artwork.altText)
            .frame(maxHeight: ThemeEffects.artworkMaxHeight)
        }
        Text("Put it up for sale now?")
          .themeFont(.titleL)
          .foregroundStyle(colors.text)
          .multilineTextAlignment(.center)
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
    .announces(String(localized: "Your design is ready! Put it up for sale now?"))
  }
}
