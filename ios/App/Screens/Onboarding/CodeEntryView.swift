import SwiftUI

/// Dev-mode sign in with a studio code (`POST /auth/code`).
struct CodeEntryView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var code = ""
  @State private var busy = false
  @State private var error: String?
  @State private var prefilled = false

  var body: some View {
    FlowScreen(title: "Your code", subtitle: "Your studio gave you a short code. Type it or say it.") {
      VStack(alignment: .leading, spacing: Theme.Space.l) {
        if app.sessionExpired {
          Card {
            Text("You were signed out to keep your studio safe. Type your code to keep going.")
              .themeFont(.body)
              .foregroundStyle(colors.text)
          }
          .onAppear {
            UIAccessibility.post(notification: .announcement, argument: String(localized: "You were signed out to keep your studio safe. Type your code to keep going."))
          }
        }
        if prefilled {
          Card {
            Text("We filled in your code from the link. Tap Sign in.")
              .themeFont(.body)
              .foregroundStyle(colors.text)
          }
        }
        LabeledTextField(label: "Sign-in code", text: $code, prompt: "Type your code here", keyboard: .asciiCapable)
          .textInputAutocapitalization(.characters)
          .autocorrectionDisabled()
          .onAppear(perform: takePendingCode)
          .onChange(of: app.pendingCode) { _, _ in takePendingCode() }
          .onChange(of: code) { _, _ in if prefilled, cleaned.isEmpty { prefilled = false } }
        if let error { ErrorCard(message: error) }
      }
    } actions: {
      PillButton(busy ? "Signing in…" : "Sign in", hint: "Checks your code and opens your studio") {
        Task { await signIn() }
      }
      .disabled(busy || cleaned.isEmpty)
    }
  }

  /// A code that arrived through a link is used once, then cleared.
  private func takePendingCode() {
    guard let pending = app.pendingCode else { return }
    code = pending
    prefilled = true
    app.pendingCode = nil
    UIAccessibility.post(notification: .announcement, argument: String(localized: "We filled in your code from the link. Tap Sign in."))
  }

  /// Spoken codes arrive with spaces and punctuation; keep letters, digits and dashes.
  private var cleaned: String {
    code.uppercased().filter { $0.isLetter || $0.isNumber || $0 == "-" }
  }

  private func signIn() async {
    busy = true
    error = nil
    defer { busy = false }
    do {
      try await app.signIn(code: cleaned)
    } catch {
      self.error = error.localizedDescription
    }
  }
}
