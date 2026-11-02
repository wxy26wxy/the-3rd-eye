import AVFoundation
import SwiftUI

/// What a loading screen shows under its headline.
enum LoadingMedia {
  /// The sky card with a looping animation (`Resources/Animations/<resource>.mp4`); width / height
  /// `aspect`. With Reduce Motion: the standing mascot on the sky (`.mascot`) or the animation's
  /// first frame (`.firstFrame`).
  case animation(resource: String, aspect: CGFloat, radius: CGFloat = Theme.Radius.card, reduced: SkyCard.ReducedMotion = .mascot)
  /// The creator's art (Figma `Art preview`, label "YOUR ART"): Changing your art, Making your cutout.
  case art(Artwork?, photo: UIImage?)
}

/// Sky wait state: logo mark, headline (and a description under it on Making your sticker), the
/// sky card or the creator's art, the "YOU ASKED" card, a 15 pt message line and a spinner. On error:
/// the message, then Try again / Go back (or the screen's own back label) at the bottom. Announces
/// itself to VoiceOver.
struct LoadingScreen: View {
  let title: LocalizedStringKey
  var subtitle: LocalizedStringKey?
  let detail: LocalizedStringResource
  var media: LoadingMedia = .animation(resource: Tokens.Asset.mascotMagnifier, aspect: ThemeEffects.skyCardAspect)
  /// What the creator asked for ("YOU ASKED" card); announced to VoiceOver before the detail.
  var spoken: String?
  var error: String?
  var retry: (() -> Void)?
  var backLabel: LocalizedStringKey = "Go back"
  /// Finding your drawings shows only its message line under the card (no spinner on `21:4390`).
  var showsSpinner = true
  /// Finding your drawings sets its message line in the muted colour (`21:4390`); the v3 loading
  /// boards set it in ink.
  var mutedDetail = false
  @Environment(\.themeColors) private var colors
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    let page = ScrollView {
      VStack(alignment: .leading, spacing: Theme.Space.xxl) {
        VStack(alignment: .leading, spacing: Theme.Space.l) {
          LogoMark().frame(minHeight: Theme.Size.minTarget)
          DisplayText(title)
          if let subtitle {
            Text(subtitle)
              .themeFont(.body)
              .foregroundStyle(colors.textMuted)
              .fixedSize(horizontal: false, vertical: true)
          }
        }
        mediaView
        if let error {
          ErrorCard(message: error)
        } else {
          if let spoken, !spoken.isEmpty {
            Card {
              VStack(alignment: .leading, spacing: Theme.Space.xs) {
                Text("YOU ASKED").themeFont(.eyebrow).foregroundStyle(colors.textMuted)
                Text(spoken).themeFont(.bodyL).foregroundStyle(colors.text)
              }
            }
            .accessibilityElement(children: .combine)
          }
          VStack(spacing: Theme.Space.l) {
            Text(detail)
              .themeFont(.body)
              .foregroundStyle(mutedDetail ? colors.textMuted : colors.text)
              .multilineTextAlignment(.center)
            if showsSpinner {
              ProgressView()
                .controlSize(.large)
                .tint(colors.text)
                .accessibilityLabel(Text("Working"))
            }
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
          PillButton(backLabel, kind: .secondary, showsArrow: false) { dismiss() }
        }
      } else {
        page
      }
    }
    .screenBackground()
    .toolbar(.hidden, for: .navigationBar)
    .accessibilityElement(children: .contain)
    .onAppear {
      // One announcement, so the request and the detail don't cut each other off.
      let parts = [spoken, String(localized: detail)].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
      UIAccessibility.post(notification: .announcement, argument: parts.joined(separator: " "))
    }
  }

  @ViewBuilder private var mediaView: some View {
    switch media {
    case let .animation(resource, aspect, radius, reduced):
      SkyCard(resource: error == nil ? resource : nil, aspect: aspect, radius: radius, reducedMotion: reduced)
    case let .art(art, photo):
      ArtPreview(label: "Your art", art: art, photo: photo)
    }
  }
}

/// Sky card (Figma `Sky card`): 28 pt corners; a looping animation, or (no animation, or Reduce
/// Motion) the standing mascot on the sky photo. Decorative.
struct SkyCard: View {
  /// What Reduce Motion shows instead of the animation.
  enum ReducedMotion { case mascot, firstFrame }

  var pose: TagMascot.Pose = .front
  /// A looping MP4 in `Resources/Animations` (the searching mascot, the sticker being made).
  var resource: String?
  var aspect: CGFloat = ThemeEffects.skyCardAspect
  var radius: CGFloat = Theme.Radius.card
  var reducedMotion: ReducedMotion = .mascot
  /// Where the still mascot stands: centred, or at the left (You're live, with the sticker at the right).
  var mascotAlignment: Alignment = .bottom
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
    Color.clear
      .aspectRatio(aspect, contentMode: .fit)
      .overlay {
        if let resource, !reduceMotion {
          LoopingVideo(resource: resource)
        } else if let resource, reducedMotion == .firstFrame {
          VideoStill(resource: resource)
        } else {
          Image(Tokens.Asset.sky)
            .resizable()
            .scaledToFill()
            .overlay(alignment: mascotAlignment) {
              Image(pose == .book ? Tokens.Asset.mascotBook : Tokens.Asset.mascotFront)
                .resizable()
                .scaledToFit()
                // At most the slot the boards give the still mascot, so the small source is not
                // blown up to the card width.
                .frame(maxWidth: ThemeEffects.stillMascot.width, maxHeight: ThemeEffects.stillMascot.height)
                .padding(.top, Theme.Space.xxl)
                .padding(.horizontal, mascotAlignment == .bottom ? 0 : Theme.Space.xxl)
                .padding(.bottom, mascotAlignment == .bottom ? 0 : Theme.Space.section)
            }
        }
      }
      .clipShape(shape)
      .frame(maxWidth: .infinity)
      .accessibilityHidden(true)
  }
}

/// The first frame of a bundled MP4, aspect-filling (Reduce Motion stand-in for `LoopingVideo`).
struct VideoStill: View {
  let resource: String
  @State private var frame: UIImage?

  var body: some View {
    Group {
      if let frame {
        Image(uiImage: frame).resizable().scaledToFill()
      } else {
        Color.clear
      }
    }
    .task(id: resource) { frame = await Self.firstFrame(of: resource) }
  }

  static func firstFrame(of resource: String) async -> UIImage? {
    guard let url = Bundle.main.url(forResource: resource, withExtension: "mp4") else { return nil }
    let generator = AVAssetImageGenerator(asset: AVURLAsset(url: url))
    generator.appliesPreferredTrackTransform = true
    guard let image = try? await generator.image(at: .zero).image else { return nil }
    return UIImage(cgImage: image)
  }
}
