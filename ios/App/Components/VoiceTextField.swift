import SwiftUI

/// Labelled text field with a mic: every text input can be spoken.
struct VoiceTextField: View {
  let label: LocalizedStringKey
  @Binding var text: String
  var prompt: LocalizedStringKey?
  var axis: Axis = .horizontal
  var keyboard: UIKeyboardType = .default
  var appendsVoice = false
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var capture: VoiceCapture?

  var body: some View {
    VStack(alignment: .leading, spacing: Theme.Space.xs) {
      Text(label).themeFont(.eyebrow).foregroundStyle(colors.textMuted).accessibilityHidden(true)
      HStack(alignment: .center, spacing: Theme.Space.s) {
        TextField(text: $text, prompt: prompt.map { Text($0) }, axis: axis) { Text(label) }
          .themeFont(.bodyL)
          .foregroundStyle(colors.text)
          .keyboardType(keyboard)
          .padding(.horizontal, Theme.Space.l)
          .padding(.vertical, Theme.Space.m)
          .frame(minHeight: Theme.Size.cta)
          .background(RoundedRectangle(cornerRadius: Theme.Radius.m).fill(colors.surfaceAlt))
          .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.thin))
          .accessibilityLabel(Text(label))
        if let capture {
          MicIconButton(capture: capture, label: "Say it instead of typing") { spoken in
            text = appendsVoice && !text.isEmpty ? text + " " + spoken : spoken
          }
        }
      }
      if let error = capture?.error {
        Text(error).themeFont(.caption).foregroundStyle(colors.danger)
      }
    }
    .onAppear { if capture == nil { capture = VoiceCapture(api: app.api) } }
  }
}
