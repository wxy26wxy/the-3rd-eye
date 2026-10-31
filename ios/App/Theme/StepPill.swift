import SwiftUI

/// Retired in Sky (no step pill on the boards). Draws nothing; VoiceOver still hears
/// "Step n of 3" as a hint-sized static text so the progress is not lost.
struct StepPill: View {
  let step: Int
  let total: Int

  var body: some View {
    Color.clear
      .frame(width: 1, height: 1)
      .accessibilityElement()
      .accessibilityLabel(Text("Step \(step) of \(total)"))
  }
}
