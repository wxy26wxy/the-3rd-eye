import SwiftUI

/// Sky headline: Inter Medium (Bold on a photo), ink on the white page, no stroke, tilt or shadow.
/// Left-aligned by default, as on the boards; `alignment: .center` for the celebration screens.
struct DisplayText: View {
  private let text: Text
  private let role: TextRole
  private let fill: Color?
  private let alignment: TextAlignment
  private let onPhoto: Bool
  @Environment(\.themeColors) private var colors

  /// `tilted` is kept so older call sites compile; Sky has no tilt (tokens `display.tilt` 0).
  init(_ key: LocalizedStringKey, role: TextRole = .displayXL, fill: Color? = nil, alignment: TextAlignment = .leading,
       onPhoto: Bool = false, tilted: Bool = false) {
    self.text = Text(key)
    self.role = role
    self.fill = fill
    self.alignment = alignment
    self.onPhoto = onPhoto
  }

  init(verbatim: String, role: TextRole = .displayXL, fill: Color? = nil, alignment: TextAlignment = .leading,
       onPhoto: Bool = false, tilted: Bool = false) {
    self.text = Text(verbatim)
    self.role = role
    self.fill = fill
    self.alignment = alignment
    self.onPhoto = onPhoto
  }

  private var frameAlignment: Alignment {
    switch alignment {
    case .center: return .center
    case .trailing: return .trailing
    default: return .leading
    }
  }

  var body: some View {
    text
      .themeFont(role)
      .fontWeight(onPhoto ? TextRole.fontWeight(ThemeEffects.displayWeightOnPhoto) : role.weight)
      .multilineTextAlignment(alignment)
      .foregroundStyle(fill ?? (onPhoto ? colors.textOnDark : colors.text))
      .fixedSize(horizontal: false, vertical: true)
      .frame(maxWidth: .infinity, alignment: frameAlignment)
      .rotationEffect(Theme.displayTilt)
      .accessibilityAddTraits(.isHeader)
  }
}
