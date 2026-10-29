import UIKit

enum ImageTools {
  /// Redraws at scale 1 with the longest side ≤ `maxPixels`, orientation baked in,
  /// so candidate boxes (pixels of the uploaded original) map 1:1 to `size`.
  static func normalized(_ image: UIImage, maxPixels: CGFloat = 2048) -> UIImage {
    let pixelSize = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
    let ratio = min(1, maxPixels / max(pixelSize.width, pixelSize.height))
    let target = CGSize(width: (pixelSize.width * ratio).rounded(), height: (pixelSize.height * ratio).rounded())
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    return UIGraphicsImageRenderer(size: target, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: target))
    }
  }

  static func jpeg(_ image: UIImage) -> Data? { image.jpegData(compressionQuality: 0.85) }
}
