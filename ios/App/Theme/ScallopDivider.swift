import SwiftUI

/// Retired in Sky (no scallop on the boards; `effects.scallop.height` 0). Draws nothing.
struct ScallopDivider: View {
  var color: Color?

  var body: some View {
    EmptyView()
  }
}

/// Retired in Sky: no cream sheet. Lays its content out on the page with the page padding,
/// so older call sites keep their spacing.
struct CreamSheet<Content: View>: View {
  @ViewBuilder var content: Content

  var body: some View {
    content
      .padding(.horizontal, Theme.Space.page)
      .padding(.bottom, Theme.Space.page)
      .frame(maxWidth: .infinity)
  }
}
