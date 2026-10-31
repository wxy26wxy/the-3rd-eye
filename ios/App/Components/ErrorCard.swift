import SwiftUI

/// Sky error card (Figma `Error card`): white, 1.5 pt border, an ink warning glyph, the message at 15 pt
/// and an underlined Try again in a 44 pt target. Inline error with an optional retry. Read out by VoiceOver when it appears.
struct ErrorCard: View {
  let message: String
  var retry: (() -> Void)?
  @Environment(\.themeColors) private var colors

  var body: some View {
    HStack(alignment: .top, spacing: Theme.Space.m) {
      Image(systemName: "exclamationmark.triangle")
        .font(TextRole.body.font)
        .foregroundStyle(colors.text)
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: Theme.Space.s) {
        Text(message).themeFont(.body).foregroundStyle(colors.text)
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
    .background(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous).fill(colors.surface))
    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous).strokeBorder(colors.border, lineWidth: Theme.Border.card))
    .accessibilityElement(children: .combine)
    .onAppear { UIAccessibility.post(notification: .announcement, argument: message) }
  }
}
