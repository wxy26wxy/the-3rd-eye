import SwiftUI

/// Board "Choose how to add your art" (`21:4340`, v3): two method rows, the first green as on the
/// board. Voice-only creation is gone (photo first); the voice comes back on Change it.
struct ChooseMethodView: View {
  @Environment(AppState.self) private var app

  var body: some View {
    FlowScreen(
      title: "How do you want to add your art?",
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
      }
    }
  }
}
