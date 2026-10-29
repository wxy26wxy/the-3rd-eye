import SwiftUI

/// Full-screen wait state with the mascot. Announces itself to VoiceOver.
struct LoadingScreen: View {
  let title: LocalizedStringKey
  let detail: LocalizedStringResource
  var pose: TagMascot.Pose = .listening
  var error: String?
  var retry: (() -> Void)?
  @Environment(\.themeColors) private var colors
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    VStack(spacing: Theme.Space.xxl) {
      Spacer()
      TagMascot(pose: error == nil ? pose : .waving)
      DisplayText(title, role: .displayL)
      if let error {
        Card {
          VStack(alignment: .leading, spacing: Theme.Space.m) {
            Text(error).themeFont(.bodyL).foregroundStyle(colors.text)
            if let retry { PillButton("Try again", hint: "Repeats the last step", action: retry) }
            PillButton("Go back", kind: .secondary, showsArrow: false) { dismiss() }
          }
        }
      } else {
        Text(detail)
          .themeFont(.bodyL)
          .foregroundStyle(colors.textOnDark)
          .multilineTextAlignment(.center)
        ProgressView()
          .controlSize(.large)
          .tint(colors.textOnDark)
          .accessibilityLabel(Text("Working"))
      }
      Spacer()
    }
    .padding(Theme.Space.page)
    .screenBackground()
    .toolbar(.hidden, for: .navigationBar)
    .accessibilityElement(children: .contain)
    .onAppear {
      UIAccessibility.post(notification: .announcement, argument: String(localized: detail))
    }
    .stopsSpeechOnDisappear()
  }
}
