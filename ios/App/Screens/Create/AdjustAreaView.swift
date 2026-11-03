import SwiftUI

/// "Adjust the area" (round 4, T141): the local photo on the green card with the frame over the
/// whole photo (or the last frame, coming back). Nothing is sent from here: the frame is in pixels
/// of the local photo. The four corners (44 pt handles) and the four edges drag; a drag inside the
/// frame moves it. "Use this area" goes on to Making your cutout, which crops the photo to the
/// frame, uploads only the crop and cuts out the drawing in it; nothing found comes back here with
/// "move or grow the frame". "Reset" puts the frame back over the whole photo; "Take a new photo"
/// goes back to the camera or the library.
///
/// Coordinates: the frame is drawn with the same view ↔ image mapping as the other photo screens
/// (`CutoutGeometry.fitRect` / `viewRect`).
///
/// VoiceOver: the photo and frame are one element, "Area frame", whose value is its size; the
/// actions grow, shrink and move it by 10 % of the photo and each says the new size (or that it is
/// at the edge / the smallest size). Copy: docs/design/copy-v4.md.
struct AdjustAreaView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var area: AreaFrame?
  @State private var drag: (start: AreaFrame, handle: AreaFrame.Handle, at: CGPoint)?
  @State private var error: String?

  var body: some View {
    FlowScreen(title: "Adjust the area", subtitle: subtitle, step: (2, 3)) {
      VStack(spacing: Theme.Space.l) {
        if let size = imageSize {
          photoArea(size: size)
        } else {
          ErrorCard(message: String(localized: "The photo is missing. Go back and take it again."))
        }
        if let error { ErrorCard(message: error) }
      }
    } actions: {
      PillButton("Use this area", hint: "Cuts out what is inside the frame") {
        useThisArea()
      }
      .disabled(area == nil)
      PillButton("Reset", hint: "Puts the frame back around the whole photo", kind: .secondary, showsArrow: false) {
        reset()
      }
      .disabled(area == nil || area == startArea)
      PillButton("Take a new photo", hint: "Goes back to take or pick another photo", kind: .secondary, showsArrow: false) {
        takeNewPhoto()
      }
    }
    .onAppear {
      if area == nil { area = lastArea ?? startArea }
      // Back from Making your cutout: nothing was found in the crop.
      if let message = flow.areaError {
        flow.areaError = nil
        error = message
        UIAccessibility.post(notification: .announcement, argument: message)
      }
    }
  }

  // MARK: State

  private var flow: CreateFlow { app.flow }

  /// Pixels of the local photo (the frame's coordinate space).
  private var imageSize: ImageSize? { flow.localPhotoSize }

  /// The whole photo.
  private var startArea: AreaFrame? { imageSize.map { AreaFrame.initial(piece: nil, image: $0) } }

  /// The frame last used on this photo (Back from Your cutout, a resolution refusal).
  private var lastArea: AreaFrame? {
    guard let box = flow.areaBox, box.count == 4 else { return nil }
    return AreaFrame(box: box)
  }

  private var subtitle: LocalizedStringKey { "Drag the corners so the frame covers your drawing." }

  /// "Frame covers 45 by 33 percent of the photo" (copy v4).
  static func sizeText(_ area: AreaFrame, image: ImageSize) -> String {
    let share = area.percent(of: image)
    return String(localized: "Frame covers \(share.width) by \(share.height) percent of the photo")
  }

  /// What a VoiceOver action says: the new size, or why the frame did not change.
  static func announcement(from old: AreaFrame, to new: AreaFrame, shrinking: Bool, image: ImageSize) -> String {
    guard new == old else { return sizeText(new, image: image) }
    return shrinking ? String(localized: "The frame can't get smaller") : String(localized: "The frame is at the edge of the photo")
  }

  // MARK: Photo

  private func photoArea(size: ImageSize) -> some View {
    // The frame has the picture's own aspect whatever image loads, so view points map to
    // `imageSize` pixels exactly (`CutoutGeometry.fitRect`).
    Color.clear
      .aspectRatio(size.w / size.h, contentMode: .fit)
      .overlay { photoImage }
      .frame(maxHeight: Theme.photoMaxHeight - 2 * ThemeEffects.photoCardInset)
      .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.s))
      .softShadow()
      .overlay {
        // The touch surface reaches half a target past the photo, so a handle on the photo's edge
        // (the whole-photo start frame, a frame grown to the edge) still has its full 44 pt.
        GeometryReader { geo in
          let reach = CGFloat(AreaFrame.handleReach)
          let fit = AreaFrame.surface(photo: CGSize(width: geo.size.width - 2 * reach, height: geo.size.height - 2 * reach),
                                      image: size, reach: reach).fit
          if let area, let rect = CutoutGeometry.viewRect(box: area.box, shownIn: fit, image: size) {
            ZStack {
              frameDrawing(rect: rect, in: fit)
              AreaDragSurface(
                handleAt: { point in
                  let handle = AreaFrame.handle(at: point, rect: rect, tolerance: reach)
                  // A frame over the whole photo cannot move: leave that touch to the scroll view.
                  return handle == .move && area == .whole(size) ? nil : handle
                },
                began: { handle, point in drag = (area, handle, point) },
                changed: { point in move(to: point, fit: fit, size: size) },
                ended: { finishDrag(size: size) }
              )
            }
          }
        }
        .padding(-CGFloat(AreaFrame.handleReach))
      }
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(Text("Area frame"))
      .accessibilityValue(Text(area.map { Self.sizeText($0, image: size) } ?? ""))
      .accessibilityHint(Text("Drag a corner or an edge to change the area. Swipe up or down for more actions."))
      .accessibilityActions {
        Button("Grow 10 %") { apply { $0.grown(in: size) } }
        Button("Shrink 10 %") { apply(shrinking: true) { $0.shrunk(in: size) } }
        Button("Move up 10 %") { apply { $0.moved(.up, in: size) } }
        Button("Move down 10 %") { apply { $0.moved(.down, in: size) } }
        Button("Move left 10 %") { apply { $0.moved(.left, in: size) } }
        Button("Move right 10 %") { apply { $0.moved(.right, in: size) } }
      }
      .accessibilityIdentifier("adjust-area")
      .frame(maxWidth: .infinity)
      // Figma `Photo card`: the picture on the green card.
      .padding(ThemeEffects.photoCardInset)
      .background(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous).fill(colors.accent))
  }

  @ViewBuilder private var photoImage: some View {
    if let photo = flow.photo {
      Image(uiImage: photo).resizable().scaledToFit()
    }
  }

  /// The photo outside the frame is dimmed; the frame is a white line with an ink edge, a round
  /// handle at each corner and a bar in the middle of each edge (touch targets are 44 pt, see
  /// `AreaFrame.handle`).
  private func frameDrawing(rect: CGRect, in fit: CGRect) -> some View {
    let knob = Theme.Size.radio
    let corners = [CGPoint(x: rect.minX, y: rect.minY), CGPoint(x: rect.maxX, y: rect.minY),
                   CGPoint(x: rect.minX, y: rect.maxY), CGPoint(x: rect.maxX, y: rect.maxY)]
    let edges = [(CGPoint(x: rect.midX, y: rect.minY), true), (CGPoint(x: rect.midX, y: rect.maxY), true),
                 (CGPoint(x: rect.minX, y: rect.midY), false), (CGPoint(x: rect.maxX, y: rect.midY), false)]
    return ZStack {
      Path { path in
        path.addRect(fit)
        path.addRect(rect)
      }
      .fill(colors.scrim, style: FillStyle(eoFill: true))
      Rectangle()
        .stroke(colors.text, lineWidth: ThemeEffects.selectedStroke * 2)
        .frame(width: rect.width, height: rect.height)
        .position(x: rect.midX, y: rect.midY)
      Rectangle()
        .stroke(colors.surface, lineWidth: ThemeEffects.selectedStroke)
        .frame(width: rect.width, height: rect.height)
        .position(x: rect.midX, y: rect.midY)
      ForEach(corners.indices, id: \.self) { index in
        Circle()
          .fill(colors.surface)
          .overlay(Circle().stroke(colors.text, lineWidth: ThemeEffects.selectedStroke))
          .frame(width: knob, height: knob)
          .position(corners[index])
      }
      ForEach(edges.indices, id: \.self) { index in
        let (point, horizontal) = edges[index]
        Capsule()
          .fill(colors.surface)
          .overlay(Capsule().stroke(colors.text, lineWidth: ThemeEffects.selectedStroke))
          .frame(width: horizontal ? knob : Theme.Space.s, height: horizontal ? Theme.Space.s : knob)
          .position(point)
      }
    }
    .allowsHitTesting(false)
    .accessibilityHidden(true)
  }

  // MARK: Editing

  private func move(to point: CGPoint, fit: CGRect, size: ImageSize) {
    guard let drag, fit.width > 0, fit.height > 0 else { return }
    let dx = (point.x - drag.at.x) * size.w / fit.width
    let dy = (point.y - drag.at.y) * size.h / fit.height
    area = drag.start.dragged(drag.handle, dx: dx, dy: dy, in: size)
  }

  private func finishDrag(size: ImageSize) {
    drag = nil
    error = nil
    if let area { UIAccessibility.post(notification: .announcement, argument: Self.sizeText(area, image: size)) }
  }

  /// A VoiceOver action: change the frame and say its new size.
  private func apply(shrinking: Bool = false, _ change: (AreaFrame) -> AreaFrame) {
    guard let current = area, let size = imageSize else { return }
    let next = change(current)
    area = next
    error = nil
    UIAccessibility.post(notification: .announcement, argument: Self.announcement(from: current, to: next, shrinking: shrinking, image: size))
  }

  private func reset() {
    guard let start = startArea else { return }
    area = start
    error = nil
    UIAccessibility.post(notification: .announcement, argument: String(localized: "Frame reset"))
  }

  // MARK: Actions

  /// "Use this area": on to Making your cutout (crop, upload, cut), or straight to Your cutout when
  /// this frame on this photo is already cut.
  private func useThisArea() {
    guard let area, app.createPath.last == .adjustArea else { return }
    error = nil
    flow.areaBox = area.box
    if let next = flow.routeAfterArea(box: area.box) { app.push(next) }
  }

  /// "Take a new photo": the photo and everything made from it go; the camera or library again.
  private func takeNewPhoto() {
    let source = flow.photoSource
    flow.discardPhoto()
    app.createPath = [.chooseMethod, .camera(source)]
  }
}

/// The frame's touch surface: a UIKit pan, so a drag that starts on a handle wins over the screen's
/// scroll view; a touch anywhere else is left to the scroll view (`handleAt` answers nil).
/// Coordinates are in this view's space, which fills the photo overlay like the drawing above it.
private struct AreaDragSurface: UIViewRepresentable {
  let handleAt: (CGPoint) -> AreaFrame.Handle?
  let began: (AreaFrame.Handle, CGPoint) -> Void
  let changed: (CGPoint) -> Void
  let ended: () -> Void

  func makeUIView(context: Context) -> UIView {
    let view = UIView()
    view.backgroundColor = .clear
    let pan = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.pan(_:)))
    pan.maximumNumberOfTouches = 1
    pan.delegate = context.coordinator
    view.addGestureRecognizer(pan)
    return view
  }

  func updateUIView(_ uiView: UIView, context: Context) {
    context.coordinator.surface = self
    // SwiftUI's `.disabled` does not reach UIKit recognisers: follow it here.
    uiView.isUserInteractionEnabled = context.environment.isEnabled
  }

  func makeCoordinator() -> Coordinator { Coordinator(surface: self) }

  @MainActor
  final class Coordinator: NSObject, UIGestureRecognizerDelegate {
    var surface: AreaDragSurface

    init(surface: AreaDragSurface) { self.surface = surface }

    /// Where the finger first touched (the pan reports a point past its movement threshold).
    private func origin(of recognizer: UIPanGestureRecognizer) -> CGPoint {
      let location = recognizer.location(in: recognizer.view)
      let moved = recognizer.translation(in: recognizer.view)
      return CGPoint(x: location.x - moved.x, y: location.y - moved.y)
    }

    func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
      guard let pan = recognizer as? UIPanGestureRecognizer else { return false }
      return surface.handleAt(origin(of: pan)) != nil
    }

    @objc func pan(_ recognizer: UIPanGestureRecognizer) {
      switch recognizer.state {
      case .began:
        let start = origin(of: recognizer)
        guard let handle = surface.handleAt(start) else { return }
        surface.began(handle, start)
        surface.changed(recognizer.location(in: recognizer.view))
      case .changed:
        surface.changed(recognizer.location(in: recognizer.view))
      default:
        surface.ended()
      }
    }
  }
}
