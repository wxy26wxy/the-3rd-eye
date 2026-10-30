import SwiftUI

/// Layout for the non-flow tabs: headline + sign-out button, cream sheet below.
struct TabScreen<Content: View>: View {
  let title: LocalizedStringKey
  @ViewBuilder var content: Content
  @Environment(\.themeColors) private var colors

  var body: some View {
    ScrollView {
      VStack(spacing: 0) {
        HStack(alignment: .center) {
          DisplayText(title, role: .displayM, tilted: false)
          Spacer()
          SignOutButton()
        }
        .padding(.horizontal, Theme.Space.page)
        .padding(.vertical, Theme.Space.l)
        CreamSheet {
          VStack(alignment: .leading, spacing: Theme.Space.l) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
      }
    }
    .background(alignment: .bottom) {
      colors.surface.frame(height: Theme.Size.record * 4).ignoresSafeArea()
    }
    .screenBackground()
    .toolbar(.hidden, for: .navigationBar)
  }
}

/// Sign out, with the account and build shown in the confirmation. Accessibility
/// settings come from iOS (VoiceOver, Dynamic Type, Increase Contrast, dictation).
struct SignOutButton: View {
  @Environment(AppState.self) private var app
  @State private var confirming = false

  var body: some View {
    IconButton(systemName: "rectangle.portrait.and.arrow.right", label: "Sign out", hint: "Asks before signing you out") { confirming = true }
      .confirmationDialog(Text("Sign out?"), isPresented: $confirming, titleVisibility: .visible) {
        Button("Sign out", role: .destructive) { app.signOut() }
        Button("Cancel", role: .cancel) {}
      } message: {
        Text(details)
      }
  }

  private var details: String {
    let build = String(localized: "Version \(AppConfig.version) (\(AppConfig.gitSHA)), \(AppConfig.siteURL.absoluteString)")
    guard let name = app.creator?.displayName else { return build }
    return String(localized: "Signed in as \(name).") + " " + build
  }
}
