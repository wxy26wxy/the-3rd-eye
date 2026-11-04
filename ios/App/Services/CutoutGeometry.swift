import CoreGraphics

/// Maps between the photo as shown (aspect-fit inside a view) and pixels of the stored
/// original (`ImageSize`), the space the API uses for `bbox`, `points` and `box`.
/// docs/api.md clarification 1: `x = (tapX - imageLeft) * imageSize.w / shownWidth`. Choose a pattern
/// and Adjust the area draw with it.
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

  /// Index of the mark whose centre is nearest to `location`, if it is within `radius` (view points).
  static func markIndex(at location: CGPoint, centres: [CGPoint], radius: CGFloat) -> Int? {
    let distances = centres.enumerated().map { ($0.offset, hypot($0.element.x - location.x, $0.element.y - location.y)) }
    guard let nearest = distances.min(by: { $0.1 < $1.1 }), nearest.1 <= radius else { return nil }
    return nearest.0
  }
}

/// What Adjust the area and Your cutout send (`POST /artworks/{id}/cleanup`).
enum CutoutRequest {
  /// The API takes at most 10 points.
  static let maxPoints = 10

  /// Adjust the area: the piece the frame was put on and the frame, which also limits the cut
  /// (`clipToBox`, docs/api.md T126). No drawing found: the frame alone.
  static func make(piece: Candidate?, area: AreaFrame) -> CleanupRequest {
    CleanupRequest(candidateIds: piece.map { [$0.id] }, box: area.box, clipToBox: true)
  }

  /// Your cutout's "Apply cutout" (T131): the piece the cut was made from, the marks, and the box —
  /// the Adjust the area frame on the photo, the whole picture after a change — which still limits
  /// the cut. Nil without marks or a usable box.
  static func marks(_ points: [CutoutPoint], on cut: Cut) -> CleanupRequest? {
    guard !points.isEmpty else { return nil }
    let box = cut.box ?? cut.imageSize.flatMap { $0.isUsable ? [0, 0, $0.w, $0.h] : nil }
    guard let box else { return nil }
    return CleanupRequest(candidateIds: cut.selected.isEmpty ? nil : cut.selected,
                          points: Array(points.prefix(maxPoints)), box: box, clipToBox: true)
  }

  /// The pick of another drawing (round 3; T155: sent by "Use this" only): the same frame (the
  /// whole picture since round 4), no marks. Nil without a usable box.
  static func pick(_ candidate: Candidate, on cut: Cut) -> CleanupRequest? {
    let box = cut.box ?? cut.imageSize.flatMap { $0.isUsable ? [0, 0, $0.w, $0.h] : nil }
    guard let box else { return nil }
    return CleanupRequest(candidateIds: [candidate.id], box: box, clipToBox: true)
  }

  /// "Add the area around your art" (VoiceOver): a positive mark at the centre of the piece the
  /// cut was made from, or of the whole picture when there is none.
  static func accessPoint(piece: Candidate?, image: ImageSize?) -> CutoutPoint? {
    if let piece, piece.bbox.count == 4, piece.bbox[0] < piece.bbox[2], piece.bbox[1] < piece.bbox[3] {
      return CutoutPoint(x: (piece.bbox[0] + piece.bbox[2]) / 2, y: (piece.bbox[1] + piece.bbox[3]) / 2, label: .positive)
    }
    guard let image, image.isUsable else { return nil }
    return CutoutPoint(x: image.w / 2, y: image.h / 2, label: .positive)
  }
}

extension CleanupResult {
  /// One plain line per kind of product trouble; nil when the products are fine.
  /// The cut-out itself was saved either way.
  var productNotice: String? {
    var lines: [String] = []
    if !failedProductIds.isEmpty {
      lines.append(String(localized: "Your cutout is saved. One product could not be rebuilt; try again later."))
    }
    if !unpublishedProductIds.isEmpty {
      lines.append(String(localized: "One product went back to draft because the new cutout is too small to print. Open My designs to fix it."))
    }
    return lines.isEmpty ? nil : lines.joined(separator: "\n")
  }

  /// What Making your cutout and Your cutout show for a failed cut: for `422 no_drawing_found`
  /// what to do about it (with marks: fewer "Remove area" marks; else a bigger frame), else the
  /// server's reason; nil for a cancelled request.
  static func errorMessage(for error: Error, request: CleanupRequest? = nil) -> String? {
    if APIError.isCancellation(error) { return nil }
    if case APIError.server(422, "no_drawing_found", _) = error {
      if request?.points?.isEmpty == false {
        return String(localized: "Nothing was left in the cutout. Remove some marks, then tap Apply cutout.")
      }
      return String(localized: "We couldn't find a drawing in that area. Make the frame bigger or move it over your drawing, then try again.")
    }
    return error.localizedDescription
  }
}
