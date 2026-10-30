import SwiftUI

/// Labelled text field. Speaking instead of typing is the keyboard's own dictation key.
struct LabeledTextField: View {
  let label: LocalizedStringKey
  @Binding var text: String
  var prompt: LocalizedStringKey?
  var axis: Axis = .horizontal
  var keyboard: UIKeyboardType = .default
  @Environment(\.themeColors) private var colors

  var body: some View {
    VStack(alignment: .leading, spacing: Theme.Space.xs) {
      Text(label).themeFont(.eyebrow).foregroundStyle(colors.textMuted).accessibilityHidden(true)
      TextField(text: $text, prompt: prompt.map { Text($0) }, axis: axis) { Text(label) }
        .themeFont(.bodyL)
        .foregroundStyle(colors.text)
        .keyboardType(keyboard)
        .padding(.horizontal, Theme.Space.l)
        .padding(.vertical, Theme.Space.m)
        .frame(minHeight: Theme.Size.cta)
        .background(RoundedRectangle(cornerRadius: Theme.Radius.m).fill(colors.surfaceAlt))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.thin))
        .accessibilityLabel(Text(label))
    }
  }
}
