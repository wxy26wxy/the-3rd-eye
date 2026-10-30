import SwiftUI

struct VideoSavedView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors

  var body: some View {
    FlowScreen(title: "Video saved!", subtitle: "We're adding captions. Every product you sell will play it.", showsBack: false) {
      VStack(spacing: Theme.Space.l) {
        TagMascot(pose: .cheering)
        if app.flow.storyVideoTrimmed {
          Text("Your video was longer than 30 seconds, so we kept the first 30.")
            .themeFont(.body)
            .foregroundStyle(colors.text)
            .multilineTextAlignment(.center)
        }
      }
    } actions: {
      PillButton("Next", hint: "Shows your live product") { app.push(.youreLive) }
    }
    .announces(String(localized: "Video saved!"))
  }
}
