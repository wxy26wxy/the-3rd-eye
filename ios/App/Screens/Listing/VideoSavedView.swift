import SwiftUI

struct VideoSavedView: View {
  @Environment(AppState.self) private var app

  var body: some View {
    FlowScreen(title: "Video saved!", subtitle: "We're adding captions. Every product you sell will play it.", showsBack: false) {
      TagMascot(pose: .cheering)
    } actions: {
      PillButton("Next", hint: "Shows your live product") { app.push(.youreLive) }
    }
    .onAppear { app.speech.speak(String(localized: "Video saved!")) }
  }
}
