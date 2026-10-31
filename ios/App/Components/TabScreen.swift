import SwiftUI

/// Sky layout for the Home tabs on the white page: a top row with the logo mark (left) and the
/// 44 pt Sign out button (right), the headline below it, then the content. No cream sheet.
/// VoiceOver order follows the boards: Sign out, headline, content.
struct TabScreen<Content: View>: View {
  let title: LocalizedStringKey
  @ViewBuilder var content: Content

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: Theme.Space.xxl) {
        VStack(alignment: .leading, spacing: Theme.Space.l) {
          HStack {
            LogoMark()
            Spacer()
            SignOutButton()
          }
          .frame(minHeight: Theme.Size.minTarget)
          DisplayText(title)
        }
        VStack(alignment: .leading, spacing: Theme.Space.l) { content }
          .frame(maxWidth: .infinity, alignment: .leading)
      }
      .padding(.horizontal, Theme.Space.page)
      .padding(.top, Theme.Space.s)
      .padding(.bottom, Theme.Space.page)
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
    IconButton(systemName: "rectangle.portrait.and.arrow.right", label: "Sign out", hint: "Asks before signing you out",
               size: Theme.Size.minTarget) { confirming = true }
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
