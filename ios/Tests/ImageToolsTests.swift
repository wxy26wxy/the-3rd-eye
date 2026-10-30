import ImageIO
import UIKit
import UniformTypeIdentifiers
import XCTest
@testable import The3rdEye

final class ImageToolsTests: XCTestCase {
  /// A camera-like JPEG carrying GPS, EXIF and TIFF metadata.
  private func photoWithLocation() throws -> Data {
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let image = UIGraphicsImageRenderer(size: CGSize(width: 40, height: 30), format: format).image { ctx in
      UIColor.green.setFill(); ctx.fill(CGRect(x: 0, y: 0, width: 40, height: 30))
    }
    let data = NSMutableData()
    let dest = try XCTUnwrap(CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil))
    let props: [CFString: Any] = [
      kCGImagePropertyGPSDictionary: [kCGImagePropertyGPSLatitude: 37.33, kCGImagePropertyGPSLatitudeRef: "N",
                                      kCGImagePropertyGPSLongitude: 122.03, kCGImagePropertyGPSLongitudeRef: "W"],
      kCGImagePropertyExifDictionary: [kCGImagePropertyExifDateTimeOriginal: "2026:10:28 09:00:00"],
      kCGImagePropertyTIFFDictionary: [kCGImagePropertyTIFFMake: "PhoneMaker", kCGImagePropertyTIFFModel: "Phone 1"],
      kCGImagePropertyOrientation: 6,
    ]
    CGImageDestinationAddImage(dest, try XCTUnwrap(image.cgImage), props as CFDictionary)
    XCTAssertTrue(CGImageDestinationFinalize(dest))
    return data as Data
  }

  private func properties(_ data: Data) throws -> [CFString: Any] {
    let source = try XCTUnwrap(CGImageSourceCreateWithData(data as CFData, nil))
    return try XCTUnwrap(CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any])
  }

  func testUploadJPEGHasNoLocationOrCameraMetadata() throws {
    let original = try photoWithLocation()
    XCTAssertNotNil(try properties(original)[kCGImagePropertyGPSDictionary], "fixture carries GPS")

    let image = try XCTUnwrap(UIImage(data: original))
    let upload = try XCTUnwrap(ImageTools.jpeg(ImageTools.normalized(image)))
    let props = try properties(upload)
    XCTAssertNil(props[kCGImagePropertyGPSDictionary])
    XCTAssertNil((props[kCGImagePropertyTIFFDictionary] as? [CFString: Any])?[kCGImagePropertyTIFFMake])
    XCTAssertNil((props[kCGImagePropertyExifDictionary] as? [CFString: Any])?[kCGImagePropertyExifDateTimeOriginal])
    // Orientation is baked into the pixels: the 40×30 photo tagged "rotate 90°" comes out 30×40.
    XCTAssertEqual(props[kCGImagePropertyPixelWidth] as? Int, 30)
    XCTAssertEqual(props[kCGImagePropertyPixelHeight] as? Int, 40)
  }

  func testRotatedImageWithoutNormalizingIsStillUpright() throws {
    let image = try XCTUnwrap(UIImage(data: try photoWithLocation()))
    XCTAssertNotEqual(image.imageOrientation, .up)
    let props = try properties(try XCTUnwrap(ImageTools.jpeg(image)))
    XCTAssertNil(props[kCGImagePropertyGPSDictionary])
    XCTAssertEqual(props[kCGImagePropertyPixelWidth] as? Int, 30)
  }
}
