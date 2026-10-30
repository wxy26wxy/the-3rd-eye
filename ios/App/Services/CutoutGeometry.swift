import CoreGraphics

/// Maps between the photo as shown (aspect-fit inside a view) and pixels of the stored
/// original (`ImageSize`), the space the API uses for `bbox`, `points` and `box`.
/// docs/api.md clarification 1: `x = (tapX - imageLeft) * imageSize.w / shownWidth`.
enum CutoutGeometry {
  /// Where an image of `image` size sits when aspect-fit into `container`.
  static func fitRect(image: ImageSize, in container: CGSize) -> CGRect {
    guard image.w > 0, image.h > 0, container.width > 0, container.height > 0 else { return .zero }
    let scale = min(container.width / image.w, container.height / image.h)
    let size = CGSize(width: image.w * scale, height: image.h * scale)
    return CGRect(x: (container.width - size.width) / 2, y: (container.height - size.height) / 2, width: size.width, height: size.height)
  }

  /// A point in view coordinates → image pixels, clamped to the image.
  static func imagePoint(_ point: CGPoint, shownIn frame: CGRect, image: ImageSize) -> CGPoint {
    guard frame.width > 0, frame.height > 0 else { return .zero }
    let x = (point.x - frame.minX) * image.w / frame.width
    let y = (point.y - frame.minY) * image.h / frame.height
    return CGPoint(x: min(max(x, 0), image.w), y: min(max(y, 0), image.h))
  }

  /// Image pixels → view coordinates.
  static func viewPoint(x: Double, y: Double, shownIn frame: CGRect, image: ImageSize) -> CGPoint {
    guard image.w > 0, image.h > 0 else { return frame.origin }
    return CGPoint(x: frame.minX + x * frame.width / image.w, y: frame.minY + y * frame.height / image.h)
  }

  /// `[x0, y0, x1, y1]` in image pixels → a view rectangle (nil for a malformed box).
  static func viewRect(box: [Double], shownIn frame: CGRect, image: ImageSize) -> CGRect? {
    guard box.count == 4 else { return nil }
    let a = viewPoint(x: box[0], y: box[1], shownIn: frame, image: image)
    let b = viewPoint(x: box[2], y: box[3], shownIn: frame, image: image)
    return CGRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(b.x - a.x), height: abs(b.y - a.y))
  }

  /// A drag from `start` to `end` (view coordinates) → `[x0, y0, x1, y1]` in image pixels with
  /// x0 < x1 and y0 < y1, clamped to the image; nil when the box would be empty.
  static func imageBox(from start: CGPoint, to end: CGPoint, shownIn frame: CGRect, image: ImageSize) -> [Double]? {
    let a = imagePoint(start, shownIn: frame, image: image)
    let b = imagePoint(end, shownIn: frame, image: image)
    let box = [min(a.x, b.x), min(a.y, b.y), max(a.x, b.x), max(a.y, b.y)].map { Double($0) }
    return box[0] < box[2] && box[1] < box[3] ? box : nil
  }
}

/// What the Adjust cutout screen sends.
enum CutoutRequest {
  /// The API takes at most 10 points.
  static let maxPoints = 10

  enum Action: Equatable {
    /// One candidate, no marks: `POST /artworks/{id}/select`.
    case select(candidateId: String)
    /// Anything else: `POST /artworks/{id}/cleanup`.
    case cleanup(CleanupRequest)
  }

  /// Builds the request exactly as the creator composed it: chosen candidates, marks and box
  /// (the server unions them and applies "Remove area" marks to the combined result).
  /// Nil when there is nothing to send, or when only "Remove area" marks exist with nothing to remove from.
  static func make(selected: [Candidate], points: [CutoutPoint], box: [Double]?) -> CleanupRequest? {
    let ids = selected.map(\.id)
    guard !ids.isEmpty || !points.isEmpty || box != nil else { return nil }
    if ids.isEmpty, box == nil, !points.contains(where: { $0.label == .positive }) { return nil }
    return CleanupRequest(candidateIds: ids.isEmpty ? nil : ids, points: points.isEmpty ? nil : points, box: box)
  }

  /// `select` for a single candidate without marks, else `cleanup`.
  static func action(selected: [Candidate], points: [CutoutPoint], box: [Double]?) -> Action? {
    if points.isEmpty, box == nil, selected.count == 1, let only = selected.first { return .select(candidateId: only.id) }
    return make(selected: selected, points: points, box: box).map(Action.cleanup)
  }
}

extension CleanupResult {
  /// Shown when `details.failedProductIds` is not empty; the cut-out itself was saved.
  static var rebuildFailedMessage: String {
    String(localized: "Your cutout is saved. One product could not be rebuilt; try again later.")
  }
}
