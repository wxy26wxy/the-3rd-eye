import SwiftUI

/// Many-pointed star shape for badges such as "NO PEN NEEDED!".
struct StarburstShape: Shape {
  var points: Int = 14
  var innerRatio: CGFloat = 0.82

  func path(in rect: CGRect) -> Path {
    let center = CGPoint(x: rect.midX, y: rect.midY)
    let outer = min(rect.width, rect.height) / 2
    let inner = outer * innerRatio
    var path = Path()
    let count = points * 2
    for i in 0..<count {
      let angle = (Double(i) / Double(count)) * 2 * .pi - .pi / 2
      let r = i.isMultiple(of: 2) ? outer : inner
      let p = CGPoint(x: center.x + CGFloat(cos(angle)) * r, y: center.y + CGFloat(sin(angle)) * r)
      if i == 0 { path.move(to: p) } else { path.addLine(to: p) }
    }
    path.closeSubpath()
    return path
  }
}

struct Starburst: View {
  let text: LocalizedStringKey
  @Environment(\.themeColors) private var colors
  @ScaledMetric(relativeTo: .caption) private var diameter: CGFloat = Theme.Size.record * 1.15

  var body: some View {
    Text(text)
      .themeFont(.eyebrow)
      .multilineTextAlignment(.center)
      .foregroundStyle(colors.accentInk)
      .padding(Theme.Space.l)
      .frame(width: diameter, height: diameter)
      .background(StarburstShape().fill(colors.accent))
      .overlay(StarburstShape().stroke(colors.border, lineWidth: Theme.Border.thin))
      .rotationEffect(.degrees(Tokens.displayTilt * 4))
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(Text(text))
  }
}
