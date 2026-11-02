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
}

/// What Adjust the area sends (`POST /artworks/{id}/cleanup`): the piece the frame was put on and
/// the frame, which also limits the cut (`clipToBox`, docs/api.md T126). No drawing found: the
/// frame alone.
enum CutoutRequest {
  static func make(piece: Candidate?, area: AreaFrame) -> CleanupRequest {
    CleanupRequest(candidateIds: piece.map { [$0.id] }, box: area.box, clipToBox: true)
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

  /// What Adjust the area shows for a failed request: for `422 no_drawing_found` (nothing in the
  /// frame) what to do about it, else the server's reason; nil for a cancelled request.
  static func errorMessage(for error: Error) -> String? {
    if APIError.isCancellation(error) { return nil }
    if case APIError.server(422, "no_drawing_found", _) = error {
      return String(localized: "We couldn't find a drawing in that area. Make the frame bigger or move it over your drawing, then try again.")
    }
    return error.localizedDescription
  }
}
