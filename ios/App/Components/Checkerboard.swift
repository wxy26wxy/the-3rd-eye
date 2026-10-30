import SwiftUI

/// Transparency backdrop for a cut-out preview (two theme surfaces in squares).
struct Checkerboard: View {
  var square: CGFloat = Theme.Space.m
  @Environment(\.themeColors) private var colors

  var body: some View {
    Canvas { context, size in
      context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(colors.surface))
      let columns = Int((size.width / square).rounded(.up))
      let rows = Int((size.height / square).rounded(.up))
      var path = Path()
      for row in 0..<max(rows, 0) {
        for column in 0..<max(columns, 0) where (row + column).isMultiple(of: 2) {
          path.addRect(CGRect(x: CGFloat(column) * square, y: CGFloat(row) * square, width: square, height: square))
        }
      }
      context.fill(path, with: .color(colors.surfaceAlt))
    }
    .accessibilityHidden(true)
  }
}
