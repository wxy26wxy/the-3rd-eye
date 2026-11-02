import SwiftUI

/// Board "Your cutout" (`2013:618`, simplified in T122): the cut-out of a change on a checkerboard,
/// the status line "Your cutout is ready. Here it is.", then "Use this" (pinned, goes on to Making
/// your sticker) and "Start over" (a new photo). The area is set before the change, on Adjust the
/// area, so this screen makes no request.
struct YourCutoutView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors

  private var flow: CreateFlow { app.flow }
  private var cut: Artwork? { flow.cutoutArtwork?.cleanedUrl != nil ? flow.cutoutArtwork : nil }

  var body: some View {
    FlowScreen(title: "Your cutout", subtitle: "Here's your cutout.", step: (3, 3)) {
      VStack(spacing: Theme.Space.l) {
        if let cut {
          cutoutImage(cut)
          Text("Your cutout is ready. Here it is.")
            .themeFont(.body)
            .foregroundStyle(colors.text)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
        } else {
          ErrorCard(message: String(localized: "Your art is missing. Go back and pick it again."))
        }
      }
    } actions: {
      PillButton("Use this", hint: "Uses this cutout and makes your product") { useThis() }
        .disabled(cut == nil)
      PillButton("Start over", hint: "Starts again from the camera", kind: .secondary, showsArrow: false) {
        let source = flow.photoSource
        flow.discardPhoto()
        app.createPath = [.chooseMethod, .camera(source)]
      }
    }
  }

  private func cutoutImage(_ artwork: Artwork) -> some View {
    ZStack {
      Checkerboard()
      RemoteImage(url: artwork.cleanedUrl.flatMap(URL.init(string:)), altText: nil)
        .padding(Theme.Space.xl)
    }
    .aspectRatio(aspect, contentMode: .fit)
    .frame(maxHeight: Theme.photoMaxHeight)
    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous).stroke(colors.border, lineWidth: Theme.Border.card))
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text("Your cutout") + Text(verbatim: ": ") + Text(artwork.altText ?? ""))
    .accessibilityAddTraits(.isImage)
    .accessibilityIdentifier("cutout-applied")
    .frame(maxWidth: .infinity)
  }

  /// The picture's own aspect when the server sent its size, else square.
  private var aspect: CGFloat {
    guard let size = flow.imageSize, size.isUsable else { return 1 }
    return size.w / size.h
  }

  /// Goes on only while this screen is on top.
  private func useThis() {
    guard let cut, app.createPath.last == .yourCutout else { return }
    flow.artwork = cut
    app.push(.makingProduct)
  }
}
