import SwiftUI

typealias ShadowToken = (x: CGFloat, y: CGFloat, color: Color)

extension View {
  /// Blur-free offset shadow drawn as a filled copy of `shape` behind the view.
  func hardShadow<S: Shape>(_ token: ShadowToken, in shape: S, color: Color? = nil, pressed: Bool = false) -> some View {
    self
      .offset(y: pressed ? token.y : 0)
      .background(
        shape
          .fill(color ?? token.color)
          .offset(x: token.x, y: token.y)
          .accessibilityHidden(true)
      )
  }
}
