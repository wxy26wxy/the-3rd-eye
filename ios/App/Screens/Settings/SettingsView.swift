import SwiftUI

/// Accessibility preferences (saved on device and to the creator profile) and build info.
struct SettingsView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    @Bindable var app = app
    NavigationStack {
      Form {
        Section {
          pref("Speak descriptions", detail: "Read picture descriptions out loud", isOn: $app.prefs.speakDescriptions)
          pref("High contrast", detail: "Black and white with bold colors", isOn: $app.prefs.highContrast)
          pref("Large text", detail: "Bigger words everywhere", isOn: $app.prefs.largeText)
          pref("Simple mode", detail: "Fewer steps and choices", isOn: $app.prefs.simpleMode)
          pref("Voice first", detail: "Start with the microphone instead of the keyboard", isOn: $app.prefs.voiceFirst)
          pref("Helper mode", detail: "Extra tips for someone helping", isOn: $app.prefs.helperMode)
        } header: {
          Text("Accessibility").themeFont(.eyebrow)
        }

        Section {
          if let name = app.creator?.displayName {
            LabeledContent { Text(name) } label: { Text("Signed in as") }
          }
          LabeledContent { Text(verbatim: "\(AppConfig.version) (\(AppConfig.gitSHA))") } label: { Text("Version") }
          LabeledContent { Text(verbatim: AppConfig.siteURL.absoluteString) } label: { Text("Server") }
          Button(role: .destructive) {
            dismiss()
            app.signOut()
          } label: {
            Text("Sign out").frame(minHeight: Theme.Size.minTarget)
          }
        } header: {
          Text("Account").themeFont(.eyebrow)
        }
      }
      .themeFont(.body)
      .scrollContentBackground(.hidden)
      .background(colors.surface)
      .navigationTitle(Text("Settings"))
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button("Done") { dismiss() }
            .frame(minWidth: Theme.Size.minTarget, minHeight: Theme.Size.minTarget)
        }
      }
    }
    .environment(\.themeColors, app.themeColors)
    .onDisappear { Task { await app.pushPrefs() } }
  }

  private func pref(_ title: LocalizedStringKey, detail: LocalizedStringKey, isOn: Binding<Bool>) -> some View {
    Toggle(isOn: isOn) {
      VStack(alignment: .leading, spacing: Theme.Space.xs) {
        Text(title).themeFont(.titleM).foregroundStyle(colors.text)
        Text(detail).themeFont(.bodyS).foregroundStyle(colors.textMuted)
      }
    }
    .tint(colors.primary)
    .frame(minHeight: Theme.Size.cta)
  }
}
