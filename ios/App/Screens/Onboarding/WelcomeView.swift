import SwiftUI

struct WelcomeView: View {
  @Environment(\.themeColors) private var colors

  var body: some View {
    ScrollView {
      VStack(spacing: Theme.Space.xl) {
        TagMascot(pose: .waving)
        DisplayText(verbatim: Tokens.Brand.wordmark, role: .displayXL)
          .accessibilityLabel(Text(verbatim: Tokens.Brand.name))
        Text("Turn your art into things people buy.")
          .themeFont(.bodyL)
          .foregroundStyle(colors.textOnDark)
          .multilineTextAlignment(.center)

        Card {
          VStack(alignment: .leading, spacing: Theme.Space.l) {
            PromiseRow(systemName: "mic.fill", text: "Draw it, or say it out loud")
            PromiseRow(systemName: "bag.fill", text: "We make stickers and tote bags")
            PromiseRow(systemName: "wave.3.right", text: "Buyers tap to hear your story")
          }
        }

        NavigationLink(value: OnboardingRoute.code) {
          Text("Start creating")
        }
        .buttonStyle(PillButtonStyle())
        .accessibilityHint(Text("Sign in with your studio code to begin"))
      }
      .padding(Theme.Space.page)
    }
    .screenBackground()
    .toolbar(.hidden, for: .navigationBar)
  }
}

private struct PromiseRow: View {
  let systemName: String
  let text: LocalizedStringKey
  @Environment(\.themeColors) private var colors

  var body: some View {
    HStack(spacing: Theme.Space.m) {
      Image(systemName: systemName)
        .font(TextRole.titleM.font)
        .foregroundStyle(colors.accentInk)
        .frame(width: Theme.Size.iconButton, height: Theme.Size.iconButton)
        .background(Circle().fill(colors.accent))
        .overlay(Circle().stroke(colors.border, lineWidth: Theme.Border.thin))
        .accessibilityHidden(true)
      Text(text).themeFont(.titleM).foregroundStyle(colors.text)
    }
    .accessibilityElement(children: .combine)
  }
}
