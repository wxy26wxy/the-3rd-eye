import SwiftUI

/// Board "Change it · Before and after" (`2012:344`): "YOU ASKED", the art before and after side by
/// side, what the new picture shows, then "Use this" (goes on to the cut-out), "Change it again"
/// (another change, made to this result) and "Back to my original" (one change back, to the art this
/// change was made from; the chain is kept, no call: the original was never touched).
struct BeforeAfterView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  private var flow: CreateFlow { app.flow }

  var body: some View {
    FlowScreen(title: "Here's the change", step: (3, 3)) {
      VStack(spacing: Theme.Space.xxl) {
        if let asked = flow.changeAsked, !asked.isEmpty { InfoCard(eyebrow: "YOU ASKED", text: asked) }
        let layout = dynamicTypeSize.isAccessibilitySize
          ? AnyLayout(VStackLayout(spacing: Theme.Space.m))
          : AnyLayout(HStackLayout(spacing: Theme.Space.m))
        layout {
          ArtPreview(label: "Before", art: flow.changeBase, photo: flow.photo, height: ThemeEffects.beforeAfterHeight)
          ArtPreview(label: "After", art: flow.changedArtwork, height: ThemeEffects.beforeAfterHeight)
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
      PillButton("Use this", hint: "Keeps the change and makes the cutout") {
        if app.createPath.last == .beforeAfter, let next = flow.routeAfterKeepingChange() { app.push(next) }
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
    }
    .announces(flow.changedArtwork?.shownDescription)
  }

  /// Change it again: back to Change it, which now shows this result as "Your art".
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
