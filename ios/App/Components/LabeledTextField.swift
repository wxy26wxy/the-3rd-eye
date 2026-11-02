import SwiftUI

/// Labelled text field. Speaking instead of typing is the keyboard's own dictation key.
struct LabeledTextField: View {
  let label: LocalizedStringKey
  @Binding var text: String
  var prompt: LocalizedStringKey?
  var axis: Axis = .horizontal
  var keyboard: UIKeyboardType = .default
  /// A multiline field's height in lines (Figma multiline field: 112 pt, three lines).
  var lines: ClosedRange<Int>?
  @Environment(\.themeColors) private var colors

  var body: some View {
    VStack(alignment: .leading, spacing: Theme.Space.xs) {
      // Sky field label: 13 pt Medium caption in ink above a white field (Figma `Text field`).
      Text(label).themeFont(.caption).foregroundStyle(colors.text).accessibilityHidden(true)
      TextField(text: $text, prompt: prompt.map { Text($0) }, axis: axis) { Text(label) }
        .themeFont(.bodyL)
        .foregroundStyle(colors.text)
        .keyboardType(keyboard)
        .modifier(LineRange(lines: lines))
        .padding(.horizontal, Theme.Space.l)
        .padding(.vertical, Theme.Space.m)
        .frame(minHeight: Theme.Size.cta)
        .background(RoundedRectangle(cornerRadius: Theme.Radius.m).fill(colors.surface))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.thin))
        .accessibilityLabel(Text(label))
    }
  }
}

/// Applies a line range only when one is given (other fields keep their default).
private struct LineRange: ViewModifier {
  let lines: ClosedRange<Int>?

  func body(content: Content) -> some View {
    if let lines { content.lineLimit(lines) } else { content }
  }
}
