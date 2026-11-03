import SwiftUI

/// "Adjust the area" (round 3: right after the photo; also "Re-do the cutout" on a saved design): the
/// stored photo on the green card with the frame over the whole photo (a saved design starts on its
/// piece's `bbox` grown by 8 %). The four corners (44 pt handles) and the four edges drag; a drag
/// inside the frame moves it. "Use this area" goes on to Making your cutout, which looks for the
/// drawing inside the frame and cuts it out (`detect {box}`), then Your cutout; nothing found comes
/// back here with "move or grow the frame". A saved design is cut here (`detect` on a photo, `cleanup`
/// on a changed picture) and goes back to the design. "Reset" puts the frame back where it started.
///
/// Coordinates: the frame is kept in pixels of the stored original and drawn with the same
/// view ↔ image mapping as the other photo screens (`CutoutGeometry.fitRect` / `viewRect`).
///
/// VoiceOver: the photo and frame are one element, "Area frame", whose value is its size; the
/// actions grow, shrink and move it by 10 % of the photo and each says the new size (or that it is
/// at the edge / the smallest size). Copy: docs/design/copy-v4.md.
struct AdjustAreaView: View {
  /// The Create flow, or "Re-do the cutout" on a saved design (`AppState.designFlow`).
  enum Origin { case create, designs }

  var origin: Origin = .create

  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var area: AreaFrame?
  @State private var drag: (start: AreaFrame, handle: AreaFrame.Handle, at: CGPoint)?
  @State private var working = false
  @State private var error: String?
  @State private var originalURL: URL?

  var body: some View {
    FlowScreen(title: "Adjust the area", subtitle: subtitle, step: isRedo ? nil : (2, 3), showsBack: !working) {
      VStack(spacing: Theme.Space.l) {
        if let size = imageSize {
          photoArea(size: size)
        } else if error == nil {
          ProgressView().tint(colors.text).frame(minHeight: Theme.Size.record)
        }
        if let error { ErrorCard(message: error) }
      }
    } actions: {
      PillButton(working ? "Cutting out your art…" : "Use this area", hint: "Cuts out what is inside the frame") {
        Task { await useThisArea() }
      }
      .disabled(working || area == nil || artwork == nil)
      PillButton("Reset", hint: "Puts the frame back around your drawing", kind: .secondary, showsArrow: false) {
        reset()
      }
      .disabled(working || area == nil || area == startArea)
      SlowWorkHint(active: working)
    }
    .navigationBarBackButtonHidden(working)
    .task { await loadPictureIfNeeded() }
    .onAppear {
      if area == nil { area = startArea }
      // Back from Making your cutout: nothing was found in the frame.
      if !isRedo, let message = flow.areaError {
        flow.areaError = nil
        error = message
        UIAccessibility.post(notification: .announcement, argument: message)
      }
    }
    .onChange(of: imageSize) { _, _ in if area == nil { area = startArea } }
  }

  // MARK: State

  private var isRedo: Bool { origin == .designs }

  private var flow: CreateFlow { isRedo ? app.designFlow : app.flow }

  /// The artwork the cut is made on: the photo (Create), or the saved design.
  private var artwork: Artwork? { isRedo ? flow.cutoutArtwork : flow.photoArtwork }

  /// The drawing the frame starts on: a saved design's piece (the one picked before, else the first);
  /// none for a new photo (the frame covers the whole photo, round 3).
  private var piece: Candidate? {
    guard isRedo else { return nil }
    return flow.candidates.first { flow.selectedCandidateIds.contains($0.id) } ?? flow.candidates.first
  }

  private var localPhoto: UIImage? { isRedo ? nil : flow.photo }

  /// The server's size; for the local photo it falls back to the photo's pixels.
  private var imageSize: ImageSize? {
    if let size = isRedo ? flow.imageSize : flow.photoImageSize, size.isUsable { return size }
    guard let photo = localPhoto else { return nil }
    let size = ImageSize(w: photo.size.width * photo.scale, h: photo.size.height * photo.scale)
    return size.isUsable ? size : nil
  }

  private var startArea: AreaFrame? { imageSize.map { AreaFrame.initial(piece: piece, image: $0) } }

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
            .disabled(working)
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
    if let photo = localPhoto {
      Image(uiImage: photo).resizable().scaledToFit()
    } else {
      RemoteImage(url: originalURL, altText: String(localized: "Your photo"))
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
    guard !working, let current = area, let size = imageSize else { return }
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

  // MARK: Requests

  /// Without the local photo or a usable size, the stored original (`GET /artworks/{id}`, presigned)
  /// and its drawings.
  private func loadPictureIfNeeded() async {
    let flow = flow
    guard let artwork, localPhoto == nil || imageSize == nil else { return }
    do {
      let detail = try await app.api.artworkDetail(id: artwork.id)
      if let size = detail.imageSize, size.isUsable {
        if isRedo { flow.imageSize = size } else { flow.photoImageSize = size }
      }
      if isRedo, flow.candidates.isEmpty { flow.candidates = detail.candidates }
      originalURL = detail.originalUrl.flatMap(URL.init(string:))
      if area == nil { area = startArea }
    } catch {
      if APIError.isCancellation(error) { return }
      if imageSize == nil { self.error = error.localizedDescription }
    }
  }

  /// "Use this area": on to Making your cutout, which sends `detect` with the frame (round 3); the
  /// frame already cut (Back from Your cutout, then Use this area again) goes straight to Your
  /// cutout. On a saved design the cut is made here (`detect` on the photo row, `cleanup` with the
  /// piece on a changed picture, which `detect` refuses with `409 not_a_photo`) and the screen goes
  /// back to it; the result is written to the flow the request started with, even if the tab changed.
  private func useThisArea() async {
    let flow = flow
    guard artwork != nil, let area else { return }
    error = nil
    guard isRedo else {
      if app.createPath.last == .adjustArea, let next = flow.routeAfterArea(box: area.box) { app.push(next) }
      return
    }
    guard let artwork else { return }
    working = true
    defer { working = false }
    do {
      let result: CleanupResult
      if Self.isPhotoRow(artwork) {
        do {
          let found = try await app.api.detect(artworkId: artwork.id, box: area.box)
          flow.candidates = found.candidates
          flow.selectedCandidateIds = found.candidates.first.map { [$0.id] } ?? []
          if let size = found.imageSize, size.isUsable { flow.imageSize = size }
          result = found.cleanupResult
        } catch APIError.server(409, "not_a_photo", _) {
          result = try await app.api.cleanup(artworkId: artwork.id, CutoutRequest.make(piece: piece, area: area))
        }
      } else {
        result = try await app.api.cleanup(artworkId: artwork.id, CutoutRequest.make(piece: piece, area: area))
      }
      if flow.cutoutArtwork == nil { flow.cutoutArtwork = artwork }
      flow.recordCut(result)
      if let cut = flow.cutoutArtwork { app.designs.replace(cut) }
      guard app.designsPath.last == .adjustArea else { return }
      app.designsPath.removeLast()
      Task { await app.designs.load() }
    } catch {
      if let message = CleanupResult.errorMessage(for: error) { self.error = message }
    }
  }
}

extension AdjustAreaView {
  /// `detect` works on the photo row only (round 3): not on a changed picture or a drawn idea.
  static func isPhotoRow(_ artwork: Artwork) -> Bool {
    artwork.parentArtworkId == nil && (artwork.changeInstruction ?? "").isEmpty
      && (artwork.source == nil || artwork.source == "photo" || artwork.source == "canvas")
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
