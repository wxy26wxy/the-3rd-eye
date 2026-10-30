import SwiftUI

@main
struct The3rdEyeApp: App {
  @State private var app = AppState()
  @Environment(\.scenePhase) private var scenePhase

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(app)
        .onOpenURL { url in app.open(url) }
    }
    .onChange(of: scenePhase) { _, phase in app.scenePhaseChanged(phase) }
  }
}
