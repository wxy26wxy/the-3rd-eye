import SwiftUI

/// Signed out → Welcome / code entry. Signed in → Home tabs.
struct RootView: View {
  @Environment(AppState.self) private var app

  var body: some View {
    Group {
      if app.isSignedIn {
        HomeView()
      } else {
        NavigationStack {
          WelcomeView()
        }
      }
    }
    .environment(\.themeColors, app.themeColors)
    .dynamicTypeSize(app.prefs.largeText ? DynamicTypeSize.xxxLarge ... .accessibility5 : DynamicTypeSize.xSmall ... .accessibility5)
    .tint(app.themeColors.primary)
    .task { await app.refreshCreator() }
  }
}
