import SwiftUI

/// Board "Change it · Before and after" (`2012:344`): "YOU ASKED", the two product photos side by
/// side (round 4 ruling 2: the product of the art the change was made from, and the change's own,
/// made on Changing), what the new picture shows, then "Use this" (Change it on the change, its
/// photo at once), "Change it again" (Change it on the change, for another change), "Back to my
/// original" (one change back; the chain is kept, no call) and "Fix the cutout" (Your cutout of the
/// change, whose "Use this" returns to Change it).
struct BeforeAfterView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  private var flow: CreateFlow { app.flow }

  var body: some View {
    FlowScreen(title: "Here's the change", subtitle: isTote ? "Your tote bag, before and after" : "Your sticker, before and after", step: (3, 3)) {
      VStack(spacing: Theme.Space.xxl) {
        if let asked = flow.changeAsked, !asked.isEmpty { InfoCard(eyebrow: "YOU ASKED", text: asked) }
        let layout = dynamicTypeSize.isAccessibilitySize
          ? AnyLayout(VStackLayout(spacing: Theme.Space.m))
          : AnyLayout(HStackLayout(spacing: Theme.Space.m))
        layout {
          ArtPreview(label: "Before", art: flow.changeBase, url: productURL(of: flow.changeBase), height: ThemeEffects.beforeAfterHeight)
            .accessibilityIdentifier("before-product")
          ArtPreview(label: "After", art: flow.changedArtwork, url: productURL(of: flow.changedArtwork), height: ThemeEffects.beforeAfterHeight)
            .accessibilityIdentifier("after-product")
        }
        if let text = flow.changedArtwork?.shownDescription { DescriptionCard(text: text) }
        if let diff = flow.changeDifferences?.trimmingCharacters(in: .whitespacesAndNewlines), !diff.isEmpty {
          Text("Different from what you asked: \(diff)")
            .themeFont(.bodyS)
            .foregroundStyle(colors.textMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
      }
    } actions: {
      PillButton("Use this", hint: "Keeps the change") {
        backToChangeIt()
      }
      .disabled(flow.changedArtwork == nil)
      PillButton("Change it again", hint: "Draws a new version with your change", kind: .secondary, showsArrow: false) {
        backToChangeIt()
      }
      Button { backToOriginal() } label: {
        Text("Back to my original")
          .themeFont(.body)
          .underline()
          .foregroundStyle(colors.text)
          .frame(minWidth: Theme.Size.minTarget, minHeight: Theme.Size.minTarget)
          .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .accessibilityHint(Text("Goes back to the art before this change"))
      Button { fixTheCutout() } label: {
        Text("Fix the cutout")
          .themeFont(.body)
          .underline()
          .foregroundStyle(colors.text)
          .frame(minWidth: Theme.Size.minTarget, minHeight: Theme.Size.minTarget)
          .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .disabled(flow.changedArtwork.flatMap { flow.cut(for: $0.id) } == nil)
      .accessibilityHint(Text("Opens the cutout of the change to add or remove areas"))
    }
    .announces(flow.changedArtwork?.shownDescription)
  }

  private var isTote: Bool { flow.productType == .tote }

  /// The product photo of an art in the chain (the parent's, the change's), else the art itself.
  private func productURL(of art: Artwork?) -> URL? {
    guard let art else { return nil }
    let cut = flow.cutArtwork(art.id) ?? art
    guard let made = flow.products[art.id] else { return nil }
    return ProductPicture.url(type: flow.productType, product: made, artwork: cut)
  }

  /// Fix the cutout: Your cutout of the change on screen.
  private func fixTheCutout() {
    guard app.createPath.last == .beforeAfter, let change = flow.changedArtwork, flow.cut(for: change.id) != nil else { return }
    app.push(.yourCutout(change.id))
  }

  /// Use this / Change it again: back to Change it, which now shows this result.
  private func backToChangeIt() {
    if app.createPath.last == .beforeAfter { app.createPath.removeLast() }
  }

  /// Back to my original: one change back (the previous change, or the picked piece); the chain
  /// stays, and the changes stay on the server.
  private func backToOriginal() {
    flow.stepBack()
    backToChangeIt()
    UIAccessibility.post(notification: .announcement,
                         argument: flow.changedArtwork == nil ? String(localized: "Back to your original art") : String(localized: "Back to your last change"))
  }
}
