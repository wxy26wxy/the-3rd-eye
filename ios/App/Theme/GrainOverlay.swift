import SwiftUI
import UIKit

/// Tiled monochrome noise at tokens.grainOpacity. Decorative; hidden from VoiceOver.
struct GrainOverlay: View {
  private static let tile: UIImage = makeTile(size: ThemeEffects.grainTile)

  var body: some View {
    Image(uiImage: Self.tile)
      .resizable(resizingMode: .tile)
      .opacity(Theme.grainOpacity)
      .blendMode(.multiply)
      .allowsHitTesting(false)
      .accessibilityHidden(true)
      .ignoresSafeArea()
  }

  private static func makeTile(size: Int) -> UIImage {
    var generator = SystemRandomNumberGenerator()
    var bytes = [UInt8](repeating: 0, count: size * size)
    for i in bytes.indices { bytes[i] = UInt8.random(in: 0...UInt8.max, using: &generator) }
    let data = Data(bytes) as CFData
    guard let provider = CGDataProvider(data: data),
          let image = CGImage(
            width: size, height: size, bitsPerComponent: 8, bitsPerPixel: 8, bytesPerRow: size,
            space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGBitmapInfo(rawValue: 0),
            provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)
    else { return UIImage() }
    return UIImage(cgImage: image)
  }
}

/// Green ground + grain behind a screen.
struct ScreenBackground: ViewModifier {
  @Environment(\.themeColors) private var colors

  func body(content: Content) -> some View {
    content
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
      .background {
        ZStack {
          colors.bg.ignoresSafeArea()
          if colors.showsGrain { GrainOverlay() }
        }
      }
  }
}

extension View {
  func screenBackground() -> some View { modifier(ScreenBackground()) }
}
