import SwiftUI

/// Inline error with an optional retry. Read out by VoiceOver when it appears.
struct ErrorCard: View {
  let message: String
  var retry: (() -> Void)?
  @Environment(\.themeColors) private var colors

  var body: some View {
    HStack(alignment: .top, spacing: Theme.Space.m) {
      Image(systemName: "exclamationmark.triangle.fill")
        .foregroundStyle(colors.danger)
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: Theme.Space.s) {
        Text(message).themeFont(.bodyS).foregroundStyle(colors.text)
        if let retry {
          Button("Try again", action: retry)
            .themeFont(.body)
            .foregroundStyle(colors.text)
            .underline()
            .frame(minHeight: Theme.Size.minTarget)
            .accessibilityHint(Text("Repeats the last step"))
        }
      }
      Spacer(minLength: 0)
    }
    .padding(Theme.Space.m)
    .background(RoundedRectangle(cornerRadius: Theme.Radius.m).fill(colors.surfaceAlt))
    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.danger, lineWidth: Theme.Border.thin))
    .accessibilityElement(children: .combine)
    .onAppear { UIAccessibility.post(notification: .announcement, argument: message) }
  }
}
