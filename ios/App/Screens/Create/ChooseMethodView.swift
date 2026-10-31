import SwiftUI

/// Board "Choose how to make it · Cloud studio" (`21:4340`): three method rows; the first is the
/// green one on the board; the voice row carries the eyebrow "NO DRAWING SKILL NEEDED".
struct ChooseMethodView: View {
  @Environment(AppState.self) private var app

  var body: some View {
    FlowScreen(
      title: "How do you want to make it?",
      subtitle: "Choose how you want to bring your drawing into the studio.",
      step: (2, 3)
    ) {
      VStack(spacing: Theme.Space.s) {
        MethodRow(icon: Tokens.Asset.iconCamera, name: "Take a photo", detail: "Snap your drawing", highlighted: true) {
          app.push(.camera(.camera))
        }
        MethodRow(icon: Tokens.Asset.iconImage, name: "Upload a picture", detail: "Pick one you already have") {
          app.push(.camera(.library))
        }
        MethodRow(icon: Tokens.Asset.iconMic, name: "Say it out loud", detail: "Describe it, we draw it for you",
                  eyebrow: "NO DRAWING SKILL NEEDED") {
          app.push(.speak)
        }
      }
    }
  }
}
