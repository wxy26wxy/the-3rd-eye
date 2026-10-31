import SwiftUI

struct WelcomeView: View {
  @Environment(\.themeColors) private var colors

  var body: some View {
    GeometryReader { proxy in
      ScrollView {
        VStack(alignment: .leading, spacing: Theme.Space.xl) {
          LogoMark(onPhoto: true).frame(minHeight: Theme.Size.minTarget)
          VStack(alignment: .leading, spacing: Theme.Space.m) {
            DisplayText(verbatim: Tokens.Brand.wordmark, onPhoto: true)
              .accessibilityLabel(Text(verbatim: Tokens.Brand.name))
            Text("Turn your art into things people buy.")
              .themeFont(.bodyL)
              .foregroundStyle(colors.textOnDark)
          }
          .padding(Theme.Space.l)
          .background(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous).fill(colors.scrim))

          Spacer(minLength: Theme.Space.section)

          Card {
            VStack(alignment: .leading, spacing: Theme.Space.l) {
              PromiseRow(systemName: "mic.fill", text: "Draw it, or say it out loud")
              PromiseRow(systemName: "bag.fill", text: "We make stickers and tote bags")
              PromiseRow(systemName: "wave.3.right", text: "Buyers tap to hear your story")
            }
          }
        }
        .padding(.horizontal, Theme.Space.page)
        .padding(.top, Theme.Space.s)
        .padding(.bottom, Theme.Space.l)
        .frame(maxWidth: .infinity, minHeight: proxy.size.height, alignment: .topLeading)
      }
      .scrollBounceBehavior(.basedOnSize)
    }
    .actionBar(onPhoto: true) {
      // Pinned so it is on screen at every text size (T103 fix round 1).
      NavigationLink(value: OnboardingRoute.code) {
        Text("Start creating")
      }
      .buttonStyle(PillButtonStyle(kind: .onPhoto))
      .accessibilityHint(Text("Sign in with your studio code to begin"))
    }
    .background {
      // Full-bleed sky photo with the waving mascot (decorative).
      Image(Tokens.Asset.welcomeBg)
        .resizable()
        .scaledToFill()
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
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
        .frame(width: Theme.Size.methodIcon, height: Theme.Size.methodIcon)
        .background(Circle().fill(colors.accent))
        .accessibilityHidden(true)
      Text(text).themeFont(.titleM).foregroundStyle(colors.text)
    }
    .accessibilityElement(children: .combine)
  }
}
