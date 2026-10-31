import SwiftUI

/// Retired in Sky (`effects.grain.opacity` 0). Draws nothing.
struct GrainOverlay: View {
  var body: some View {
    EmptyView()
  }
}

/// The white page (`semantic.bg`) behind a screen.
struct ScreenBackground: ViewModifier {
  @Environment(\.themeColors) private var colors

  func body(content: Content) -> some View {
    content
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
      .background { colors.bg.ignoresSafeArea() }
  }
}

extension View {
  func screenBackground() -> some View { modifier(ScreenBackground()) }
}
