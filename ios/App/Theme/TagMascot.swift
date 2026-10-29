import SwiftUI

/// "Tag", the story-tag mascot, drawn with Shapes. Decorative unless given a label.
struct TagMascot: View {
  enum Pose { case listening, cheering, waving }

  let pose: Pose
  var size: CGFloat = Theme.Size.record * 1.6
  @Environment(\.themeColors) private var colors
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var wave = false

  var body: some View {
    let line = Theme.Border.card
    ZStack {
      // Arms sit behind the body.
      ArmsShape(pose: pose)
        .stroke(colors.border, style: StrokeStyle(lineWidth: line * 2.2, lineCap: .round, lineJoin: .round))
        .rotationEffect(.degrees(pose == .waving && wave ? 6 : 0), anchor: .center)

      TagBodyShape()
        .fill(colors.border, style: FillStyle(eoFill: true))
        .offset(y: Theme.Shadow.hard.y)
      TagBodyShape()
        .fill(colors.accent, style: FillStyle(eoFill: true))
      TagBodyShape()
        .stroke(colors.border, lineWidth: line)
      FaceShape(pose: pose)
        .fill(colors.border)
      SmileShape(pose: pose)
        .stroke(colors.border, style: StrokeStyle(lineWidth: line, lineCap: .round))
      if pose != .waving {
        ExtrasShape(pose: pose)
          .stroke(colors.border, style: StrokeStyle(lineWidth: line, lineCap: .round))
      }
    }
    .frame(width: size, height: size)
    .accessibilityHidden(true)
    .onAppear {
      guard pose == .waving, !reduceMotion else { return }
      withAnimation(.easeInOut(duration: ThemeEffects.motionSlow * 2).repeatForever(autoreverses: true)) {
        wave = true
      }
    }
  }
}

private extension CGRect {
  func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: minX + width * x, y: minY + height * y) }
}

/// Tag silhouette: rounded body with a clipped top and a punched hole.
private struct TagBodyShape: Shape {
  func path(in r: CGRect) -> Path {
    var path = Path()
    path.move(to: r.p(0.36, 0.14))
    path.addLine(to: r.p(0.64, 0.14))
    path.addLine(to: r.p(0.78, 0.30))
    path.addQuadCurve(to: r.p(0.74, 0.90), control: r.p(0.84, 0.86))
    path.addLine(to: r.p(0.26, 0.90))
    path.addQuadCurve(to: r.p(0.22, 0.30), control: r.p(0.16, 0.86))
    path.closeSubpath()
    let hole = CGRect(origin: r.p(0.46, 0.20), size: CGSize(width: r.width * 0.08, height: r.width * 0.08))
    path.addEllipse(in: hole)
    return path
  }
}

private struct FaceShape: Shape {
  let pose: TagMascot.Pose
  func path(in r: CGRect) -> Path {
    var path = Path()
    let eye = r.width * 0.06
    let eyeY: CGFloat = pose == .cheering ? 0.47 : 0.49
    path.addEllipse(in: CGRect(origin: r.p(0.38, eyeY), size: CGSize(width: eye, height: eye * 1.25)))
    path.addEllipse(in: CGRect(origin: r.p(0.56, eyeY), size: CGSize(width: eye, height: eye * 1.25)))
    return path
  }
}

private struct SmileShape: Shape {
  let pose: TagMascot.Pose
  func path(in r: CGRect) -> Path {
    var path = Path()
    let depth: CGFloat = pose == .cheering ? 0.78 : 0.72
    path.move(to: r.p(0.40, 0.64))
    path.addQuadCurve(to: r.p(0.60, 0.64), control: r.p(0.50, depth))
    return path
  }
}

private struct ArmsShape: Shape {
  let pose: TagMascot.Pose
  func path(in r: CGRect) -> Path {
    var path = Path()
    switch pose {
    case .cheering:
      path.move(to: r.p(0.24, 0.55)); path.addLine(to: r.p(0.08, 0.22))
      path.move(to: r.p(0.76, 0.55)); path.addLine(to: r.p(0.92, 0.22))
    case .waving:
      path.move(to: r.p(0.24, 0.60)); path.addLine(to: r.p(0.10, 0.80))
      path.move(to: r.p(0.76, 0.55)); path.addLine(to: r.p(0.93, 0.25))
    case .listening:
      path.move(to: r.p(0.24, 0.60)); path.addLine(to: r.p(0.10, 0.80))
      path.move(to: r.p(0.76, 0.58)); path.addQuadCurve(to: r.p(0.86, 0.36), control: r.p(0.94, 0.52))
    }
    return path
  }
}

/// Sound waves for listening, stars for cheering.
private struct ExtrasShape: Shape {
  let pose: TagMascot.Pose
  func path(in r: CGRect) -> Path {
    var path = Path()
    switch pose {
    case .listening:
      path.move(to: r.p(0.90, 0.20)); path.addQuadCurve(to: r.p(0.98, 0.34), control: r.p(0.97, 0.24))
      path.move(to: r.p(0.86, 0.10)); path.addQuadCurve(to: r.p(1.0, 0.30), control: r.p(0.99, 0.12))
    case .cheering:
      for c in [r.p(0.06, 0.08), r.p(0.94, 0.06), r.p(0.50, 0.02)] {
        let s = r.width * 0.035
        path.move(to: CGPoint(x: c.x - s, y: c.y)); path.addLine(to: CGPoint(x: c.x + s, y: c.y))
        path.move(to: CGPoint(x: c.x, y: c.y - s)); path.addLine(to: CGPoint(x: c.x, y: c.y + s))
      }
    case .waving:
      break
    }
    return path
  }
}
