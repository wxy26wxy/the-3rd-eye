import ImageIO
import UIKit
import UniformTypeIdentifiers

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

  /// JPEG of the pixels only: no EXIF, GPS, TIFF (camera make/model) or maker notes
  /// from the original photo. Written with ImageIO so nothing but the quality is set.
  static func jpeg(_ image: UIImage, quality: CGFloat = 0.85) -> Data? {
    let upright = image.imageOrientation == .up ? image : normalized(image, maxPixels: .greatestFiniteMagnitude)
    guard let cg = upright.cgImage else { return nil }
    let data = NSMutableData()
    guard let dest = CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
    CGImageDestinationAddImage(dest, cg, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
    return CGImageDestinationFinalize(dest) ? data as Data : nil
  }
}
