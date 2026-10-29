import SwiftUI

/// Bagel Fat One headline with ink stroke, hard drop shadow and the design tilt.
struct DisplayText: View {
  private let text: Text
  private let role: TextRole
  private let fill: Color?
  private let tilted: Bool
  @Environment(\.themeColors) private var colors

  init(_ key: LocalizedStringKey, role: TextRole = .displayL, fill: Color? = nil, tilted: Bool = true) {
    self.text = Text(key)
    self.role = role
    self.fill = fill
    self.tilted = tilted
  }

  init(verbatim: String, role: TextRole = .displayL, fill: Color? = nil, tilted: Bool = true) {
    self.text = Text(verbatim)
    self.role = role
    self.fill = fill
    self.tilted = tilted
  }

  private var strokeOffsets: [CGSize] {
    let w = ThemeEffects.displayStrokeWidth
    return [
      CGSize(width: -w, height: -w), CGSize(width: 0, height: -w), CGSize(width: w, height: -w),
      CGSize(width: -w, height: 0), CGSize(width: w, height: 0),
      CGSize(width: -w, height: w), CGSize(width: 0, height: w), CGSize(width: w, height: w),
    ]
  }

  private func styled(_ color: Color) -> some View {
    text
      .themeFont(role)
      .multilineTextAlignment(.center)
      .foregroundStyle(color)
      .fixedSize(horizontal: false, vertical: true)
  }

  var body: some View {
    ZStack {
      styled(colors.border)
        .offset(y: ThemeEffects.displayShadowY)
        .accessibilityHidden(true)
      ForEach(strokeOffsets.indices, id: \.self) { i in
        styled(colors.border)
          .offset(strokeOffsets[i])
          .accessibilityHidden(true)
      }
      styled(fill ?? colors.textOnDark)
    }
    .rotationEffect(tilted ? Theme.displayTilt : .zero)
    .padding(.vertical, ThemeEffects.displayShadowY)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(text)
    .accessibilityAddTraits(.isHeader)
  }
}
