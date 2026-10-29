import SwiftUI

/// Wavy top edge for cream sheets (tokens.json effects.scallop).
struct ScallopShape: Shape {
  var amplitude: CGFloat = ThemeEffects.scallopAmplitude
  var period: CGFloat = ThemeEffects.scallopPeriod

  func path(in rect: CGRect) -> Path {
    var path = Path()
    let baseline = rect.minY + amplitude
    path.move(to: CGPoint(x: rect.minX, y: rect.maxY))
    path.addLine(to: CGPoint(x: rect.minX, y: baseline))
    var x = rect.minX
    while x < rect.maxX {
      let next = x + period
      path.addQuadCurve(
        to: CGPoint(x: next, y: baseline),
        control: CGPoint(x: x + period / 2, y: baseline - amplitude * 2)
      )
      x = next
    }
    path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
    path.closeSubpath()
    return path
  }
}

struct ScallopDivider: View {
  var color: Color?
  @Environment(\.themeColors) private var colors

  var body: some View {
    ScallopShape()
      .fill(color ?? colors.surface)
      .frame(height: ThemeEffects.scallopHeight)
      .accessibilityHidden(true)
  }
}

/// Cream sheet with a scalloped top, used for the lower half of screens.
struct CreamSheet<Content: View>: View {
  @ViewBuilder var content: Content
  @Environment(\.themeColors) private var colors

  var body: some View {
    VStack(spacing: 0) {
      ScallopDivider()
      content
        .padding(.horizontal, Theme.Space.page)
        .padding(.top, Theme.Space.s)
        .padding(.bottom, Theme.Space.page)
        .frame(maxWidth: .infinity)
        .background(colors.surface)
    }
  }
}
