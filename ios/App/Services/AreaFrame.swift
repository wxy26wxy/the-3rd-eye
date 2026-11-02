import CoreGraphics

/// Adjust the area (T122): the frame around the art, `[x0, y0, x1, y1]` in pixels of the stored
/// original (`ImageSize`), the space `cleanup`'s `box` uses. It starts on the picked drawing's
/// `bbox` grown by 8 %, or on the whole photo when no drawing was found; corners and edges are
/// dragged, VoiceOver grows, shrinks and moves it by 10 % of the photo. Every result stays inside the photo and
/// at least `minSide` wide and tall.
struct AreaFrame: Equatable {
  var x0: Double
  var y0: Double
  var x1: Double
  var y1: Double

  /// The picked drawing's box grows by this share of its own size (half on each side).
  static let growth = 0.08
  /// One VoiceOver step, a share of the photo: grow / shrink by 10 % (5 % on each side), move by 10 %.
  static let step = 0.10
  /// The smallest frame side, as a share of the photo's shorter side.
  static let minShare = 0.05

  enum Handle: CaseIterable, Equatable {
    case topLeading, top, topTrailing, trailing, bottomTrailing, bottom, bottomLeading, leading
    /// A drag inside the frame moves it.
    case move
  }

  enum Direction: CaseIterable { case up, down, left, right }

  init(x0: Double, y0: Double, x1: Double, y1: Double) {
    self.x0 = x0
    self.y0 = y0
    self.x1 = x1
    self.y1 = y1
  }

  /// `[x0, y0, x1, y1]` → a frame (nil unless four numbers).
  init?(box: [Double]?) {
    guard let box, box.count == 4 else { return nil }
    self.init(x0: min(box[0], box[2]), y0: min(box[1], box[3]), x1: max(box[0], box[2]), y1: max(box[1], box[3]))
  }

  var box: [Double] { [x0, y0, x1, y1] }
  var width: Double { x1 - x0 }
  var height: Double { y1 - y0 }

  static func whole(_ image: ImageSize) -> AreaFrame { AreaFrame(x0: 0, y0: 0, x1: image.w, y1: image.h) }

  static func minSide(_ image: ImageSize) -> Double { min(image.w, image.h) * minShare }

  /// Where the frame starts: the piece's bbox grown by 8 % and clamped to the photo; the whole
  /// photo when there is no piece (no drawing found) or its bbox is malformed.
  static func initial(piece: Candidate?, image: ImageSize) -> AreaFrame {
    guard let piece, let bbox = AreaFrame(box: piece.bbox), bbox.width > 0, bbox.height > 0 else { return whole(image) }
    let dx = bbox.width * growth / 2
    let dy = bbox.height * growth / 2
    return AreaFrame(x0: bbox.x0 - dx, y0: bbox.y0 - dy, x1: bbox.x1 + dx, y1: bbox.y1 + dy).clamped(to: image)
  }

  /// Inside the photo and at least `minSide` on each side (a frame larger than the photo becomes
  /// the photo; one off the edge is cut at the edge, then widened back inside if it got too thin).
  func clamped(to image: ImageSize) -> AreaFrame {
    let side = Self.minSide(image)
    func axis(_ a: Double, _ b: Double, limit: Double) -> (Double, Double) {
      var lo = max(0, min(a, b))
      var hi = min(limit, max(a, b))
      if hi - lo < side {
        let centre = min(max((lo + hi) / 2, side / 2), limit - side / 2)
        lo = centre - side / 2
        hi = centre + side / 2
      }
      return (lo, hi)
    }
    let (nx0, nx1) = axis(x0, x1, limit: image.w)
    let (ny0, ny1) = axis(y0, y1, limit: image.h)
    return AreaFrame(x0: nx0, y0: ny0, x1: nx1, y1: ny1)
  }

  /// The frame after dragging `handle` by `dx`, `dy` image pixels from where the drag began. The
  /// dragged edge stops at the photo's edge and `minSide` from the opposite edge; a move keeps the
  /// size and stops at the photo's edges.
  func dragged(_ handle: Handle, dx: Double, dy: Double, in image: ImageSize) -> AreaFrame {
    let side = Self.minSide(image)
    var next = self
    switch handle {
    case .move:
      let sx = min(max(dx, -x0), image.w - x1)
      let sy = min(max(dy, -y0), image.h - y1)
      return AreaFrame(x0: x0 + sx, y0: y0 + sy, x1: x1 + sx, y1: y1 + sy)
    default:
      break
    }
    if [.topLeading, .leading, .bottomLeading].contains(handle) { next.x0 = min(max(x0 + dx, 0), x1 - side) }
    if [.topTrailing, .trailing, .bottomTrailing].contains(handle) { next.x1 = max(min(x1 + dx, image.w), x0 + side) }
    if [.topLeading, .top, .topTrailing].contains(handle) { next.y0 = min(max(y0 + dy, 0), y1 - side) }
    if [.bottomLeading, .bottom, .bottomTrailing].contains(handle) { next.y1 = max(min(y1 + dy, image.h), y0 + side) }
    return next.clamped(to: image)
  }

  /// "Grow 10 %" (copy v4): each side moves out 5 % of the photo, stopping at the photo's edges.
  func grown(in image: ImageSize) -> AreaFrame {
    let dx = image.w * Self.step / 2
    let dy = image.h * Self.step / 2
    return AreaFrame(x0: max(0, x0 - dx), y0: max(0, y0 - dy), x1: min(image.w, x1 + dx), y1: min(image.h, y1 + dy))
  }

  /// "Shrink 10 %": each side moves in 5 % of the photo, stopping at the smallest size (around the
  /// frame's centre).
  func shrunk(in image: ImageSize) -> AreaFrame {
    let side = Self.minSide(image)
    func axis(_ lo: Double, _ hi: Double, by d: Double) -> (Double, Double) {
      let size = max(hi - lo - 2 * d, min(side, hi - lo))
      let centre = (lo + hi) / 2
      return (centre - size / 2, centre + size / 2)
    }
    let (nx0, nx1) = axis(x0, x1, by: image.w * Self.step / 2)
    let (ny0, ny1) = axis(y0, y1, by: image.h * Self.step / 2)
    return AreaFrame(x0: nx0, y0: ny0, x1: nx1, y1: ny1)
  }

  /// Moved by 10 % of the photo in `direction`, stopping at the edge.
  func moved(_ direction: Direction, in image: ImageSize) -> AreaFrame {
    switch direction {
    case .up: return dragged(.move, dx: 0, dy: -image.h * Self.step, in: image)
    case .down: return dragged(.move, dx: 0, dy: image.h * Self.step, in: image)
    case .left: return dragged(.move, dx: -image.w * Self.step, dy: 0, in: image)
    case .right: return dragged(.move, dx: image.w * Self.step, dy: 0, in: image)
    }
  }

  /// Whole percentages of the photo's width and height the frame covers (for VoiceOver).
  func percent(of image: ImageSize) -> (width: Int, height: Int) {
    guard image.isUsable else { return (0, 0) }
    return (Int((width / image.w * 100).rounded()), Int((height / image.h * 100).rounded()))
  }

  /// Half a touch target: how far the handles' touch areas reach past the frame, and so how far the
  /// touch surface reaches past the photo (a frame on the photo's edge keeps 44 pt handles).
  static let handleReach = Double(Theme.Size.minTarget) / 2

  /// The touch surface around a photo shown in `photo` (its own aspect): the photo grown by
  /// `handleReach` on every side, and where the photo sits inside that surface.
  static func surface(photo: CGSize, image: ImageSize, reach: CGFloat = CGFloat(handleReach)) -> (bounds: CGRect, fit: CGRect) {
    let bounds = CGRect(x: 0, y: 0, width: photo.width + 2 * reach, height: photo.height + 2 * reach)
    let fit = CutoutGeometry.fitRect(image: image, in: photo).offsetBy(dx: reach, dy: reach)
    return (bounds, fit)
  }

  /// The handle under `point` (view coordinates) on a frame drawn at `rect`: a corner within
  /// `tolerance` of both its edges, else an edge within `tolerance`, else `.move` inside the frame;
  /// nil outside it (that touch scrolls the screen).
  static func handle(at point: CGPoint, rect: CGRect, tolerance: CGFloat) -> Handle? {
    let nearLeft = abs(point.x - rect.minX) <= tolerance
    let nearRight = abs(point.x - rect.maxX) <= tolerance
    let nearTop = abs(point.y - rect.minY) <= tolerance
    let nearBottom = abs(point.y - rect.maxY) <= tolerance
    let withinX = point.x >= rect.minX - tolerance && point.x <= rect.maxX + tolerance
    let withinY = point.y >= rect.minY - tolerance && point.y <= rect.maxY + tolerance
    guard withinX, withinY else { return nil }
    // The nearer edge wins when the frame is thinner than two tolerances.
    let left = nearLeft && (!nearRight || abs(point.x - rect.minX) <= abs(point.x - rect.maxX))
    let right = nearRight && !left
    let top = nearTop && (!nearBottom || abs(point.y - rect.minY) <= abs(point.y - rect.maxY))
    let bottom = nearBottom && !top
    switch (left, right, top, bottom) {
    case (true, _, true, _): return .topLeading
    case (_, true, true, _): return .topTrailing
    case (true, _, _, true): return .bottomLeading
    case (_, true, _, true): return .bottomTrailing
    case (true, _, _, _): return .leading
    case (_, true, _, _): return .trailing
    case (_, _, true, _): return .top
    case (_, _, _, true): return .bottom
    default: return rect.contains(point) ? .move : nil
    }
  }
}
