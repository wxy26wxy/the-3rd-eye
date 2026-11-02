import SwiftUI

/// Board "Pick sticker or tote · Cloud studio" (`45:700`): two product cards side by side (the
/// mascot sticker and the tote photo), a radio in each, then Next. At accessibility text sizes the
/// cards stack so their words fit.
struct PickProductView: View {
  @Environment(AppState.self) private var app
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  var body: some View {
    FlowScreen(
      title: "What do you want to make?",
      subtitle: "You can make the other one later.",
      step: (1, 3),
      showsBack: false
    ) {
      let layout = dynamicTypeSize.isAccessibilitySize
        ? AnyLayout(VStackLayout(spacing: Theme.Space.l))
        : AnyLayout(HStackLayout(alignment: .top, spacing: Theme.Space.s))
      layout {
        product(.sticker, name: "Sticker", detail: "Die-cut, waterproof")
        product(.tote, name: "Tote bag", detail: "Natural canvas")
      }
    } actions: {
      PillButton("Next", hint: "Choose how to add your art") { app.push(.chooseMethod) }
        .disabled(app.flow.productType == nil)
    }
  }

  private func product(_ type: ProductType, name: LocalizedStringKey, detail: LocalizedStringKey) -> some View {
    ProductOption(
      selected: app.flow.productType == type,
      name: name,
      detail: detail,
      image: type == .sticker ? Tokens.Asset.mascotBook : Tokens.Asset.tote,
      imageSize: type == .sticker ? ThemeEffects.productSticker : ThemeEffects.productTote,
      shadowed: type == .tote
    ) {
      app.flow.productType = type
      if app.prefs.simpleMode { app.push(.chooseMethod) }
    }
  }
}

/// Figma `Product option`: a 302 pt card (green with the deep-green radio when selected, white with
/// an empty radio when not), the product picture in the middle, name and description at the bottom.
/// One button for VoiceOver: "name, description", selected trait.
private struct ProductOption: View {
  let selected: Bool
  let name: LocalizedStringKey
  let detail: LocalizedStringKey
  let image: String
  let imageSize: CGSize
  var shadowed = false
  let action: () -> Void
  @Environment(\.themeColors) private var colors

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
    Button(action: action) {
      VStack(alignment: .leading, spacing: Theme.Space.s) {
        HStack {
          Spacer()
          RadioMark(selected: selected)
        }
        Spacer(minLength: 0)
        Group {
          if shadowed {
            Image(image).resizable().scaledToFit().softShadow()
          } else {
            Image(image).resizable().scaledToFit()
          }
        }
        .frame(maxWidth: imageSize.width, maxHeight: imageSize.height)
        .frame(maxWidth: .infinity)
        .accessibilityHidden(true)
        Spacer(minLength: 0)
        VStack(alignment: .leading, spacing: Theme.Space.xs) {
          Text(name).themeFont(.titleL).foregroundStyle(colors.text)
          Text(detail).themeFont(.bodyS).foregroundStyle(colors.accentInk)
        }
        .multilineTextAlignment(.leading)
        .fixedSize(horizontal: false, vertical: true)
      }
      .padding(Theme.Space.l)
      .frame(maxWidth: .infinity, minHeight: ThemeEffects.productCardHeight, alignment: .topLeading)
      .background(shape.fill(selected ? colors.selected : colors.surface))
      .overlay(shape.strokeBorder(selected ? colors.accentBorder : colors.border,
                                  lineWidth: selected ? Theme.Border.card : Theme.Border.thin))
      .contentShape(shape)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(Text(name) + Text(", ") + Text(detail))
    .accessibilityHint(Text("Selects this product"))
    .accessibilityAddTraits(selected ? .isSelected : [])
  }
}
