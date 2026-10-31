import SwiftUI

/// Retired in Sky (no starburst on the boards): draws nothing and is not read by VoiceOver.
/// The "No pen needed" line now lives on `MethodRow` as its eyebrow (read in the row's hint).
struct Starburst: View {
  let text: LocalizedStringKey

  var body: some View {
    EmptyView()
  }
}
