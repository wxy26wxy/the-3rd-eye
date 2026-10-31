import SwiftUI

/// Board "Welcome · Cloud studio" (`21:4229`): the full-bleed sky photo with the mascot, the white
/// logo mark, a white headline and line on a scrim, the white Start creating pill and
/// "I already have an account" (both open the code screen: creators sign in with their studio code).
struct WelcomeView: View {
  @Environment(\.themeColors) private var colors

  var body: some View {
    GeometryReader { proxy in
      ScrollView {
        VStack(alignment: .leading, spacing: Theme.Space.xl) {
          LogoMark(onPhoto: true).frame(minHeight: Theme.Size.minTarget)
          VStack(alignment: .leading, spacing: Theme.Space.m) {
            DisplayText("Your art, on things people love.", onPhoto: true)
            Text("Draw it or say it. We make the sticker or tote.")
              .themeFont(.body)
              .foregroundStyle(colors.textOnDark)
              .fixedSize(horizontal: false, vertical: true)
          }
          // The app's name for VoiceOver (the logo mark is decorative).
          .accessibilityElement(children: .combine)
          .accessibilityLabel(Text(verbatim: Tokens.Brand.name + ". ") + Text("Your art, on things people love.") + Text(verbatim: " ")
                              + Text("Draw it or say it. We make the sticker or tote."))
          .accessibilityAddTraits(.isHeader)
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
      NavigationLink(value: OnboardingRoute.code) {
        Text("I already have an account")
          .themeFont(.body)
          .fontWeight(TextRole.caption.weight)
          .foregroundStyle(colors.textOnDark)
          .multilineTextAlignment(.center)
          .frame(maxWidth: .infinity, minHeight: Theme.Size.minTarget)
          .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .accessibilityHint(Text("Sign in with your studio code"))
    }
    .background {
      // Full-bleed sky photo with the mascot (decorative); a scrim at the top keeps the white
      // headline readable on the light sky (darker with Increase Contrast).
      Image(Tokens.Asset.welcomeBg)
        .resizable()
        .scaledToFill()
        .overlay(alignment: .top) {
          LinearGradient(colors: [colors.scrim, colors.scrim, .clear], startPoint: .top, endPoint: .bottom)
            .containerRelativeFrame(.vertical) { height, _ in height * 0.6 }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
    .toolbar(.hidden, for: .navigationBar)
  }
}
