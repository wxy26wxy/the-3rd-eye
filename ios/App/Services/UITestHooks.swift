#if DEBUG
import SwiftUI
import UIKit

/// Debug-only switches read from the launch environment, used by UI tests against scripts/mock_api.py.
enum UITestHooks {
  /// `UITEST_PHOTO=1`: the photo screen uses `testPhoto` instead of the camera or the library.
  static var usesTestPhoto: Bool { ProcessInfo.processInfo.environment["UITEST_PHOTO"] == "1" }

  /// The mock answers with `imageSize` 1200 × 1600 (the server's ×2 upscale), so this is 600 × 800.
  static let testPhotoSize = CGSize(width: 600, height: 800)

  /// Two blocks on a plain page, drawn with theme colours.
  static func testPhoto(colors: ThemeColors) -> UIImage {
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let size = testPhotoSize
    return UIGraphicsImageRenderer(size: size, format: format).image { ctx in
      UIColor(colors.surface).setFill()
      ctx.fill(CGRect(origin: .zero, size: size))
      UIColor(colors.primary).setFill()
      ctx.fill(CGRect(x: size.width / 12, y: size.height / 10, width: size.width / 3, height: size.height / 3))
      UIColor(colors.accent).setFill()
      ctx.fill(CGRect(x: size.width * 0.55, y: size.height * 0.56, width: size.width / 3, height: size.height / 3))
    }
  }
}
#endif
