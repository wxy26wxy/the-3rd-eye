import SwiftUI

/// Board "1 Pick sticker or tote".
struct PickProductView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors

  var body: some View {
    FlowScreen(
      title: "What are we making?",
      subtitle: "Pick one. You can make the other next time.",
      step: (1, 3),
      showsBack: false
    ) {
      VStack(spacing: Theme.Space.l) {
        product(.sticker, icon: "seal.fill", name: "Sticker", detail: "Die-cut around your art")
        product(.tote, icon: "bag.fill", name: "Tote bag", detail: "Your art on a cotton bag")
      }
    } actions: {
      PillButton("Next", hint: "Choose how to make your art") { app.push(.chooseMethod) }
        .disabled(app.flow.productType == nil)
    }
  }

  private func product(_ type: ProductType, icon: String, name: LocalizedStringKey, detail: LocalizedStringKey) -> some View {
    let selected = app.flow.productType == type
    return ChoiceCard(
      selected: selected,
      label: Text(name) + Text(", ") + Text(detail),
      hint: Text("Selects this product")
    ) {
      app.flow.productType = type
      if app.prefs.simpleMode { app.push(.chooseMethod) }
    } content: {
      HStack(spacing: Theme.Space.l) {
        MethodIcon(systemName: icon)
        VStack(alignment: .leading, spacing: Theme.Space.xs) {
          Text(name).themeFont(.titleL).foregroundStyle(colors.text)
          Text(detail).themeFont(.bodyS).foregroundStyle(colors.textMuted)
        }
      }
    }
  }
}

/// 44 pt round icon tile used on choice cards (Sky: deep-green glyph on a white circle).
struct MethodIcon: View {
  let systemName: String
  @Environment(\.themeColors) private var colors

  var body: some View {
    Image(systemName: systemName)
      .font(TextRole.titleM.font)
      .foregroundStyle(colors.accentInk)
      .frame(width: Theme.Size.methodIcon, height: Theme.Size.methodIcon)
      .background(Circle().fill(colors.surface))
      .overlay(Circle().strokeBorder(colors.border, lineWidth: Theme.Border.thin))
      .accessibilityHidden(true)
  }
}
