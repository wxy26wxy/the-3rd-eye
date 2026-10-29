import SwiftUI

/// Board "2 Choose how to make it".
struct ChooseMethodView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors

  var body: some View {
    FlowScreen(title: "How do you want to make it?", step: (2, 3)) {
      VStack(spacing: Theme.Space.l) {
        method(icon: "camera.fill", name: "Take a photo", detail: "Snap a drawing on paper", route: .camera(.camera))
        method(icon: "photo.on.rectangle", name: "Upload a picture", detail: "Pick art from your photos", route: .camera(.library))
        method(icon: "mic.fill", name: "Say it out loud", detail: "Describe it, we draw it", route: .speak)
          .overlay(alignment: .topTrailing) {
            Starburst(text: "NO PEN NEEDED!")
              .offset(x: Theme.Space.l, y: -Theme.Space.xxl)
              .accessibilityHidden(true)
          }
      }
      .padding(.top, Theme.Space.l)
    }
  }

  private func method(icon: String, name: LocalizedStringKey, detail: LocalizedStringKey, route: CreateRoute) -> some View {
    ChoiceCard(selected: false, label: Text(name) + Text(", ") + Text(detail), hint: Text("Opens this way of making art")) {
      app.push(route)
    } content: {
      HStack(spacing: Theme.Space.l) {
        MethodIcon(systemName: icon)
        VStack(alignment: .leading, spacing: Theme.Space.xs) {
          Text(name).themeFont(.titleL).foregroundStyle(colors.text)
          Text(detail).themeFont(.bodyS).foregroundStyle(colors.textMuted)
        }
      }
    }
  }
}
