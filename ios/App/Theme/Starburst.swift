import SwiftUI

/// Retired in Sky (no starburst on the boards). The text is still read by VoiceOver when the
/// call site does not hide it; nothing is drawn.
struct Starburst: View {
  let text: LocalizedStringKey

  var body: some View {
    EmptyView()
  }
}
