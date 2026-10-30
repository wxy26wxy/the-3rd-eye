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

/// Sign out, with the account and build shown in the confirmation: version, git sha and server
/// stay there on purpose (testers read them back when reporting a problem; decision T091). Accessibility
/// settings come from iOS (VoiceOver, Dynamic Type, Increase Contrast, dictation).
struct SignOutButton: View {
  /// Accessibility identifiers, so UI tests find the header button and the confirm without
  /// relying on element order (both are labelled "Sign out").
  static let buttonID = "sign-out"
  static let confirmID = "sign-out-confirm"

  @Environment(AppState.self) private var app
  @State private var confirming = false

  var body: some View {
    IconButton(systemName: "rectangle.portrait.and.arrow.right", label: "Sign out", hint: "Asks before signing you out") { confirming = true }
      .accessibilityIdentifier(Self.buttonID)
      .confirmationDialog(Text("Sign out?"), isPresented: $confirming, titleVisibility: .visible) {
        Button("Sign out", role: .destructive) { app.signOut() }
          .accessibilityIdentifier(Self.confirmID)
        Button("Cancel", role: .cancel) {}
      } message: {
        Text(Self.details(name: app.creator?.displayName, version: AppConfig.version, sha: AppConfig.gitSHA,
                          server: AppConfig.siteURL.absoluteString))
      }
  }

  /// The dialog's message: who is signed in, then version, git sha and server.
  static func details(name: String?, version: String, sha: String, server: String) -> String {
    guard let name else { return String(localized: "Version \(version) (\(sha)), \(server)") }
    return String(localized: "Signed in as \(name). Version \(version) (\(sha)), \(server)")
  }
}
