import SwiftUI

/// Appears after a long call has run for 30 s, so the creator knows to wait
/// instead of retrying (a retry would start the same work again).
struct SlowWorkHint: View {
  var active = true
  var onDark = false
  @State private var shown = false
  @Environment(\.themeColors) private var colors

  static let delay: Duration = .seconds(30)
  static let message = String(localized: "Still working. This can take a few minutes, so please keep the app open.")

  var body: some View {
    Group {
      if shown {
        Text(Self.message)
          .themeFont(.body)
          .foregroundStyle(onDark ? colors.textOnDark : colors.text)
          .multilineTextAlignment(.center)
          .frame(maxWidth: .infinity)
      }
    }
    .task(id: active) {
      shown = false
      guard active else { return }
      try? await Task.sleep(for: Self.delay)
      guard !Task.isCancelled else { return }
      shown = true
      UIAccessibility.post(notification: .announcement, argument: Self.message)
    }
  }
}
