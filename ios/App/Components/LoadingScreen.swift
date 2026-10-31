import SwiftUI

/// Sky wait state: logo mark, headline, the sky card with the searching mascot, the "I HEARD" card,
/// a 15 pt message line and a spinner. On error: the message, then Try again / Go back at the bottom.
/// Announces itself to VoiceOver.
struct LoadingScreen: View {
  let title: LocalizedStringKey
  let detail: LocalizedStringResource
  var pose: TagMascot.Pose = .magnifier
  /// What the app understood ("I HEARD" card); announced to VoiceOver before the detail.
  var spoken: String?
  var error: String?
  var retry: (() -> Void)?
  @Environment(\.themeColors) private var colors
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    let page = ScrollView {
      VStack(alignment: .leading, spacing: Theme.Space.xxl) {
        VStack(alignment: .leading, spacing: Theme.Space.l) {
          LogoMark().frame(minHeight: Theme.Size.minTarget)
          DisplayText(title)
        }
        SkyCard(pose: error == nil ? pose : .front)
        if let error {
          Card {
            Text(error).themeFont(.body).foregroundStyle(colors.text)
          }
        } else {
          if let spoken, !spoken.isEmpty {
            Card {
              VStack(alignment: .leading, spacing: Theme.Space.xs) {
                Text("I HEARD").themeFont(.eyebrow).foregroundStyle(colors.textMuted)
                Text(spoken).themeFont(.bodyL).foregroundStyle(colors.text)
              }
            }
            .accessibilityElement(children: .combine)
          }
          VStack(spacing: Theme.Space.l) {
            Text(detail)
              .themeFont(.body)
              .foregroundStyle(colors.textMuted)
              .multilineTextAlignment(.center)
            ProgressView()
              .controlSize(.large)
              .tint(colors.text)
              .accessibilityLabel(Text("Working"))
            SlowWorkHint()
          }
          .frame(maxWidth: .infinity)
        }
      }
      .padding(.horizontal, Theme.Space.page)
      .padding(.top, Theme.Space.s)
      .padding(.bottom, Theme.Space.xxl)
      .frame(maxWidth: .infinity, alignment: .topLeading)
    }
    .scrollBounceBehavior(.basedOnSize)

    Group {
      if error != nil {
        // Error actions are pinned at the bottom (T103 fix round 1); no bar while working.
        page.actionBar {
          if let retry { PillButton("Try again", hint: "Repeats the last step", action: retry) }
          PillButton("Go back", kind: .secondary, showsArrow: false) { dismiss() }
        }
      } else {
        page
      }
    }
    .screenBackground()
    .toolbar(.hidden, for: .navigationBar)
    .accessibilityElement(children: .contain)
    .onAppear {
      // One announcement, so the confirmation and the detail don't cut each other off.
      let parts = [spoken, String(localized: detail)].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
      UIAccessibility.post(notification: .announcement, argument: parts.joined(separator: " "))
    }
  }
}

/// Sky card (Figma `Sky card`): 28 pt corners; the looping magnifier mascot, or with Reduce Motion
/// (and for still poses) the standing mascot on the sky photo. Decorative.
struct SkyCard: View {
  var pose: TagMascot.Pose = .magnifier
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
    Color.clear
      .aspectRatio(ThemeEffects.skyCardAspect, contentMode: .fit)
      .overlay {
        if pose == .magnifier && !reduceMotion {
          LoopingVideo(resource: Tokens.Asset.mascotMagnifier)
        } else {
          Image(Tokens.Asset.sky)
            .resizable()
            .scaledToFill()
            .overlay(alignment: .bottom) {
              Image(pose == .book ? Tokens.Asset.mascotBook : Tokens.Asset.mascotFront)
                .resizable()
                .scaledToFit()
                // At most the slot the boards give the still mascot, so the small source is not
                // blown up to the card width.
                .frame(maxWidth: ThemeEffects.stillMascot.width, maxHeight: ThemeEffects.stillMascot.height)
                .padding(.top, Theme.Space.xxl)
            }
        }
      }
      .clipShape(shape)
      .frame(maxWidth: .infinity)
      .accessibilityHidden(true)
  }
}
