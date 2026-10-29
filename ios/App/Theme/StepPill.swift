import SwiftUI

/// "STEP 1 OF 3" pill with progress dots.
struct StepPill: View {
  let step: Int
  let total: Int
  @Environment(\.themeColors) private var colors

  var body: some View {
    HStack(spacing: Theme.Space.s) {
      Text("STEP \(step) OF \(total)")
        .themeFont(.step)
        .foregroundStyle(colors.text)
      HStack(spacing: Theme.Space.xs) {
        ForEach(1...max(total, 1), id: \.self) { i in
          Circle()
            .fill(i <= step ? colors.primary : colors.surface)
            .overlay(Circle().stroke(colors.border, lineWidth: Theme.Border.thin / 2))
            .frame(width: Theme.Size.stepDot, height: Theme.Size.stepDot)
        }
      }
    }
    .padding(.horizontal, Theme.Space.l)
    .padding(.vertical, Theme.Space.xs)
    .background(Capsule().fill(colors.accent))
    .overlay(Capsule().stroke(colors.border, lineWidth: Theme.Border.thin))
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text("Step \(step) of \(total)"))
  }
}
