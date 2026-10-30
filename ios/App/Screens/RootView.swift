import SwiftUI

enum OnboardingRoute: Hashable { case code }

/// Signed out → Welcome / code entry. Signed in → Home tabs.
struct RootView: View {
  @Environment(AppState.self) private var app
  @State private var onboarding: [OnboardingRoute] = []

  var body: some View {
    Group {
      if app.isSignedIn {
        HomeView()
      } else {
        NavigationStack(path: $onboarding) {
          WelcomeView()
            .navigationDestination(for: OnboardingRoute.self) { _ in CodeEntryView() }
        }
      }
    }
    .environment(\.themeColors, app.themeColors)
    .dynamicTypeSize(app.prefs.largeText ? DynamicTypeSize.xxxLarge ... .accessibility5 : DynamicTypeSize.xSmall ... .accessibility5)
    .tint(app.themeColors.primary)
    .task { await app.refreshCreator() }
    .onChange(of: app.pendingCode) { _, code in
      if code != nil, !app.isSignedIn, onboarding.isEmpty { onboarding = [.code] }
    }
    .onChange(of: app.isSignedIn) { _, signedIn in
      // After an expired session, open straight on the code screen.
      onboarding = !signedIn && app.sessionExpired ? [.code] : []
    }
  }
}
