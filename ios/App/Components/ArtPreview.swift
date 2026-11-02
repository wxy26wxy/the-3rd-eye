import SwiftUI

/// Figma `Art preview` (`4021:4470`): the creator's art on the grey card, a white label chip at the
/// top left ("YOUR ART", "BEFORE", "AFTER"). The picture is one VoiceOver image: the label and the
/// alt text ("Your art: A fuzzy green monster…"); the description card next to it says more.
struct ArtPreview: View {
  let label: LocalizedStringKey
  var art: Artwork?
  /// Shown when the art has no picture of its own yet (the whole photo, before any cut-out).
  var photo: UIImage?
  var height: CGFloat = ThemeEffects.artPreviewHeight
  @Environment(\.themeColors) private var colors
  @Environment(\.colorSchemeContrast) private var contrast
  /// Grows with Dynamic Type so the label chip does not eat the picture at accessibility sizes.
  @ScaledMetric(relativeTo: .body) private var scale: CGFloat = 1

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: ThemeEffects.artPreviewRadius, style: .continuous)
    picture
      .padding(.horizontal, Theme.Space.l)
      .padding(.top, Theme.Space.section)
      .padding(.bottom, Theme.Space.m)
      .frame(maxWidth: .infinity)
      .frame(height: height * min(max(scale, 1), ThemeEffects.artPreviewMaxGrowth))
      .background(shape.fill(colors.surfaceAlt))
      // Increase Contrast: the grey card and its white chip need an edge on the white page.
      .overlay(shape.strokeBorder(contrast == .increased ? colors.border : .clear, lineWidth: Theme.Border.card))
      .overlay(alignment: .topLeading) {
        Text(label)
          .themeFont(.eyebrow)
          .textCase(.uppercase)
          .foregroundStyle(colors.text)
          .padding(.horizontal, Theme.Space.m)
          .padding(.vertical, Theme.Space.xs)
          .background(Capsule().fill(colors.surface))
          .overlay(Capsule().strokeBorder(contrast == .increased ? colors.border : .clear, lineWidth: Theme.Border.thin))
          .padding(Theme.Space.m)
          .accessibilityHidden(true)
      }
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(Text(label) + Text(verbatim: ": ") + Text(altText))
      .accessibilityAddTraits(.isImage)
  }

  @ViewBuilder private var picture: some View {
    if let url = art?.displayURL {
      RemoteImage(url: url, altText: nil)
    } else if let photo {
      Image(uiImage: photo).resizable().scaledToFit()
    } else {
      RemoteImage(url: nil, altText: nil)
    }
  }

  private var altText: String {
    art?.altText.flatMap { $0.isEmpty ? nil : $0 } ?? String(localized: "Your art")
  }
}
