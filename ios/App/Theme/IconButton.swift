import SwiftUI

/// 48 pt round cream button with an SF Symbol and a hard shadow.
struct IconButton: View {
  let systemName: String
  let label: LocalizedStringKey
  var hint: LocalizedStringKey?
  let action: () -> Void
  @Environment(\.themeColors) private var colors

  init(systemName: String, label: LocalizedStringKey, hint: LocalizedStringKey? = nil, action: @escaping () -> Void) {
    self.systemName = systemName
    self.label = label
    self.hint = hint
    self.action = action
  }

  var body: some View {
    Button(action: action) {
      Image(systemName: systemName)
        .font(TextRole.titleM.font.weight(.bold))
        .foregroundStyle(colors.text)
        .frame(width: Theme.Size.iconButton, height: Theme.Size.iconButton)
    }
    .buttonStyle(IconButtonStyle())
    .accessibilityLabel(Text(label))
    .accessibilityHint(hint.map { Text($0) } ?? Text(""))
  }
}

private struct IconButtonStyle: ButtonStyle {
  @Environment(\.themeColors) private var colors
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .background(Circle().fill(colors.surface))
      .overlay(Circle().stroke(colors.border, lineWidth: Theme.Border.icon))
      .hardShadow(Theme.Shadow.icon, in: Circle(), pressed: configuration.isPressed && !reduceMotion)
      .contentShape(Circle())
  }
}
