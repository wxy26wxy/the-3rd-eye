import SwiftUI

@main
struct The3rdEyeApp: App {
  @State private var app = AppState()
  @Environment(\.scenePhase) private var scenePhase

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(app)
        // Default for any Text not styled with `themeFont` (system controls, alerts' SwiftUI
        // content): Outfit's variable TTF would otherwise draw at its default weight, Thin.
        .font(TextRole.body.font)
        .onOpenURL { url in app.open(url) }
    }
    .onChange(of: scenePhase) { _, phase in app.scenePhaseChanged(phase) }
  }
}
