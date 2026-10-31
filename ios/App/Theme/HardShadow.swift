import SwiftUI

typealias ShadowToken = (x: CGFloat, y: CGFloat, color: Color)

extension View {
  /// Retired in Sky (no hard shadows on the boards; `shadow.hard*` are 0): returns the view unchanged.
  /// Kept so call sites compile; `pressed` and `color` are ignored.
  func hardShadow<S: Shape>(_ token: ShadowToken, in shape: S, color: Color? = nil, pressed: Bool = false) -> some View {
    self
  }

  /// `shadow.soft` (the one soft shadow on the boards: the tote photo).
  func softShadow() -> some View {
    shadow(color: Tokens.Shadow.soft.color, radius: Tokens.ShadowBlur.soft / 2, x: Tokens.Shadow.soft.x, y: Tokens.Shadow.soft.y)
  }
}
