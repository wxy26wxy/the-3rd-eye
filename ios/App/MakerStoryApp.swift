import SwiftUI

@main
struct MakerStoryApp: App {
  @State private var app = AppState()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(app)
    }
  }
}
