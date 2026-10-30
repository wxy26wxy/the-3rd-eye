import SwiftUI

extension View {
  /// Posts `text` as a VoiceOver announcement when the view appears and whenever `text` changes.
  /// The text must also be visible on screen; this only saves VoiceOver users a swipe.
  func announces(_ text: String?) -> some View {
    modifier(Announce(text: text))
  }
}

private struct Announce: ViewModifier {
  let text: String?

  func body(content: Content) -> some View {
    content
      .onAppear { post(text) }
      .onChange(of: text) { _, new in post(new) }
  }

  private func post(_ text: String?) {
    guard let trimmed = text?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else { return }
    UIAccessibility.post(notification: .announcement, argument: trimmed)
  }
}
