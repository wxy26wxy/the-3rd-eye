import SwiftUI

/// Sky bottom action bar: the screen's actions pinned to the bottom edge (above the tab bar or the
/// home indicator) while the content scrolls above it. White with a hairline top border; on a photo
/// (`onPhoto`) it sits on the photo scrim, so content scrolling under it never shows through. The scroll content gets the bar's height as bottom inset, so the
/// last content line is never covered.
struct ActionBar<Actions: View>: ViewModifier {
  var onPhoto = false
  @ViewBuilder var actions: Actions
  @Environment(\.themeColors) private var colors
  /// False while `actions` renders nothing (e.g. every action is behind an `if`), so no empty bar shows.
  @State private var hasActions = true

  func body(content: Content) -> some View {
    content.safeAreaInset(edge: .bottom, spacing: 0) {
      VStack(spacing: Theme.Space.s) { actions }
        .background {
          GeometryReader { proxy in
            Color.clear
              .onAppear { hasActions = proxy.size.height > 0 }
              .onChange(of: proxy.size.height) { _, height in hasActions = height > 0 }
          }
        }
        .padding(.horizontal, Theme.Space.page)
        .padding(.top, hasActions ? Theme.Space.m : 0)
        .padding(.bottom, hasActions ? Theme.Space.s : 0)
        .frame(maxWidth: .infinity)
        .background {
          if hasActions {
            if onPhoto {
              // Blurred photo under the scrim: content scrolling under the bar is not readable through it.
              Rectangle().fill(.ultraThinMaterial).overlay(colors.scrim).ignoresSafeArea(edges: .bottom)
            } else {
              colors.surface
                .overlay(alignment: .top) { colors.border.frame(height: Theme.Border.thin) }
                .ignoresSafeArea(edges: .bottom)
            }
          }
        }
    }
  }
}

extension View {
  /// Pins `actions` in a bottom bar (see `ActionBar`).
  func actionBar<Actions: View>(onPhoto: Bool = false, @ViewBuilder _ actions: () -> Actions) -> some View {
    modifier(ActionBar(onPhoto: onPhoto, actions: actions))
  }
}
