import SwiftUI

@main
struct MakerStoryApp: App {
  var body: some Scene {
    WindowGroup {
      VStack(spacing: Theme.Space.xl) {
        DisplayText("maker story", role: .displayXL)
        TagMascot(pose: .waving)
        PillButton("Start creating") {}
      }
      .padding(Theme.Space.page)
      .screenBackground()
    }
  }
}
