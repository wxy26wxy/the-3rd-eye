import SwiftUI

/// Board "2 Choose how to make it".
struct ChooseMethodView: View {
  @Environment(AppState.self) private var app

  var body: some View {
    FlowScreen(title: "How do you want to make it?", step: (2, 3)) {
      VStack(spacing: Theme.Space.s) {
        MethodRow(icon: Tokens.Asset.iconCamera, name: "Take a photo", detail: "Snap a drawing on paper") { app.push(.camera(.camera)) }
        MethodRow(icon: Tokens.Asset.iconImage, name: "Upload a picture", detail: "Pick art from your photos") { app.push(.camera(.library)) }
        MethodRow(icon: Tokens.Asset.iconMic, name: "Say it out loud", detail: "Describe it, we draw it", eyebrow: "NO PEN NEEDED!") { app.push(.speak) }
      }
    }
  }
}
