import ImageIO
import UIKit

/// Decoded pictures kept in memory (Ruling 3, T144): `NSCache` with a cost limit in bytes, so a
/// picture drawn once shows again at once (tab switch, back from Design detail, grid scrolling).
/// Thread-safe (`NSCache` is), so a view can look a picture up while its body is computed.
final class ImageCache: @unchecked Sendable {
  static let shared = ImageCache()

  /// About 50 MB of decoded pixels.
  static let defaultCostLimit = 50 * 1024 * 1024

  private let cache = NSCache<NSString, UIImage>()

  init(costLimit: Int = ImageCache.defaultCostLimit) {
    cache.totalCostLimit = costLimit
  }

  func image(forKey key: String) -> UIImage? { cache.object(forKey: key as NSString) }

  func insert(_ image: UIImage, forKey key: String) {
    cache.setObject(image, forKey: key as NSString, cost: Self.cost(of: image))
  }

  func removeAll() { cache.removeAllObjects() }

  /// Bytes of decoded pixels.
  static func cost(of image: UIImage) -> Int {
    if let cg = image.cgImage { return cg.bytesPerRow * cg.height }
    return Int(image.size.width * image.scale * image.size.height * image.scale * 4)
  }

  /// The cache key of `url`: the whole link for a public picture; scheme, host and path for a
  /// presigned one (its query changes on every `GET /artworks/{id}` but the file does not). A
  /// downsampled picture has its size after the link, so it never stands in for the full one.
  static func key(for url: URL, maxPixel: Int? = nil) -> String {
    var base = url.absoluteString
    if isPresigned(url), var parts = URLComponents(url: url, resolvingAgainstBaseURL: false) {
      parts.query = nil
      parts.fragment = nil
      base = parts.string ?? base
    }
    guard let maxPixel else { return base }
    return base + "#\(maxPixel)px"
  }

  /// A short-lived signed link (Blob presigned reads, S3-style signatures): its query carries a
  /// signature, token or expiry. Public links (`?p=<id>`) keep their query in the key.
  static func isPresigned(_ url: URL) -> Bool {
    guard let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems, !items.isEmpty else { return false }
    let markers = ["signature", "sig", "token", "expires", "validuntil", "x-amz-"]
    return items.contains { item in
      let name = item.name.lowercased()
      return markers.contains { name == $0 || name.hasPrefix($0) || name.hasSuffix($0) }
    }
  }
}

/// Loads pictures for `RemoteImage` (Ruling 3, T144): memory cache first (synchronous), then the
/// network with `.returnCacheDataElseLoad` (`URLCache.shared` keeps the bytes on disk; every upload
/// is a new pathname, so a cached file never goes stale), decoded off the main thread. Tiles ask for
/// a downsampled copy (`maxPixel`), cached under its own key. One request per key at a time.
@MainActor
final class ImageLoader {
  static let shared = ImageLoader()

  /// Longest side of a My designs / Orders tile picture: about a tile's width at 3x.
  static let tilePixels = 600

  let cache: ImageCache
  private let transport: HTTPTransport
  private var running: [String: Task<UIImage, Error>] = [:]

  init(cache: ImageCache = .shared, transport: HTTPTransport = URLSession.shared) {
    self.cache = cache
    self.transport = transport
  }

  /// The picture already in memory, if any (no request).
  nonisolated func cachedImage(for url: URL?, maxPixel: Int? = nil) -> UIImage? {
    guard let url else { return nil }
    return cache.image(forKey: ImageCache.key(for: url, maxPixel: maxPixel))
  }

  func image(for url: URL, maxPixel: Int? = nil) async throws -> UIImage {
    let key = ImageCache.key(for: url, maxPixel: maxPixel)
    if let hit = cache.image(forKey: key) { return hit }
    if let task = running[key] { return try await task.value }
    let transport = transport
    let task = Task<UIImage, Error> {
      let request = URLRequest(url: url, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 60)
      let (data, response) = try await transport.data(for: request)
      if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
        throw URLError(.badServerResponse)
      }
      let decoded = await Task.detached(priority: .userInitiated) { Self.decode(data, maxPixel: maxPixel) }.value
      guard let decoded else { throw URLError(.cannotDecodeContentData) }
      return decoded
    }
    running[key] = task
    defer { running[key] = nil }
    let image = try await task.value
    cache.insert(image, forKey: key)
    return image
  }

  /// A downsampled copy (longest side `maxPixel`) or the whole picture, decoded now so drawing it
  /// does not decode on the main thread.
  nonisolated static func decode(_ data: Data, maxPixel: Int?) -> UIImage? {
    if let maxPixel { return downsample(data, maxPixel: maxPixel) }
    guard let image = UIImage(data: data) else { return nil }
    return image.preparingForDisplay() ?? image
  }

  /// `CGImageSourceCreateThumbnailAtIndex` at `maxPixel` (never larger than the picture), with the
  /// EXIF orientation applied.
  nonisolated static func downsample(_ data: Data, maxPixel: Int) -> UIImage? {
    let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
    guard let source = CGImageSourceCreateWithData(data as CFData, sourceOptions) else { return nil }
    let options = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceShouldCacheImmediately: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: maxPixel,
    ] as CFDictionary
    guard let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, options) else { return nil }
    return UIImage(cgImage: thumbnail)
  }

  /// At app start: room for the 1200 px product photos on disk and in memory (the default
  /// `URLCache` stores no response above about 500 KB).
  static func configureURLCache() {
    URLCache.shared = URLCache(memoryCapacity: 50 * 1024 * 1024, diskCapacity: 300 * 1024 * 1024)
  }
}
