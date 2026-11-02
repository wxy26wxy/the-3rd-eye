import SwiftUI

/// "Adjust the area" (T122, after Choose a pattern; also "Re-do the cutout" on a saved design): the
/// photo on the green card with a frame around the picked drawing (its `bbox` grown by 8 %, the whole
/// photo when no drawing was found). The four corners (44 pt handles) and the four edges drag; a drag
/// inside the frame moves it. "Use this area" cuts out what the frame holds
/// (`cleanup {candidateIds: [piece], box}`) and goes on to Change it (a saved design: back to it);
/// "Reset" puts the frame back where it started.
///
/// Coordinates: the frame is kept in pixels of the stored original and drawn with the same
/// view ↔ image mapping as the other photo screens (`CutoutGeometry.fitRect` / `viewRect`).
///
/// VoiceOver: the photo and frame are one element, "The area to cut out", whose value is its size;
/// the actions grow, shrink and move it by 10 % (swipe up / down grows / shrinks too) and each says
/// the new size.
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
      PillButton(working ? "Cutting it out…" : "Use this area",
                 hint: isRedo ? "Cuts out what the frame holds and saves it" : "Cuts out what the frame holds and goes on") {
        Task { await useThisArea() }
      }
      .disabled(working || area == nil || artwork == nil)
      PillButton("Reset", hint: "Puts the frame back where it started", kind: .secondary, showsArrow: false) {
        reset()
      }
      .disabled(working || area == nil || area == startArea)
      SlowWorkHint(active: working)
    }
    .navigationBarBackButtonHidden(working)
    .task { await loadPictureIfNeeded() }
    .onAppear { if area == nil { area = startArea } }
    .onChange(of: imageSize) { _, _ in if area == nil { area = startArea } }
  }

  // MARK: State

  private var isRedo: Bool { origin == .designs }

  private var flow: CreateFlow { isRedo ? app.designFlow : app.flow }

  /// The artwork the cut is made on: the photo (Create), or the saved design.
  private var artwork: Artwork? { isRedo ? flow.cutoutArtwork : flow.photoArtwork }

  /// The drawing the frame starts on and the cut is made from; nil when no drawing was found. A
  /// saved design with several pieces starts on the one picked before, else the first.
  private var piece: Candidate? {
    if isRedo {
      return flow.candidates.first { flow.selectedCandidateIds.contains($0.id) } ?? flow.candidates.first
    }
    return flow.photoCandidates.first { $0.id == flow.pieceCandidateId }
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

  private var subtitle: LocalizedStringKey {
    piece == nil
      ? "We couldn't find a drawing, so the frame holds the whole photo. Drag its corners or edges to fit your art."
      : "Drag the corners or edges so the frame holds all of your art."
  }

  /// "The area is 45 % of the photo's width and 33 % of its height."
  static func sizeText(_ area: AreaFrame, image: ImageSize) -> String {
    let share = area.percent(of: image)
    return String(localized: "The area is \(share.width) % of the photo's width and \(share.height) % of its height.")
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
        GeometryReader { geo in
          let fit = CutoutGeometry.fitRect(image: size, in: geo.size)
          if let area, let rect = CutoutGeometry.viewRect(box: area.box, shownIn: fit, image: size) {
            ZStack {
              frameDrawing(rect: rect, in: fit)
              AreaDragSurface(
                handleAt: { AreaFrame.handle(at: $0, rect: rect, tolerance: Theme.Size.minTarget / 2) },
                began: { handle, point in drag = (area, handle, point) },
                changed: { point in move(to: point, fit: fit, size: size) },
                ended: { finishDrag(size: size) }
              )
            }
            .disabled(working)
          }
        }
      }
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(Text("The area to cut out"))
      .accessibilityValue(Text(area.map { Self.sizeText($0, image: size) } ?? ""))
      .accessibilityHint(Text("Use the actions to make it bigger, smaller or move it."))
      .accessibilityAdjustableAction { direction in
        switch direction {
        case .increment: apply { $0.grown(in: size) }
        case .decrement: apply { $0.shrunk(in: size) }
        @unknown default: break
        }
      }
      .accessibilityActions {
        Button("Grow 10 %") { apply { $0.grown(in: size) } }
        Button("Shrink 10 %") { apply { $0.shrunk(in: size) } }
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
  private func apply(_ change: (AreaFrame) -> AreaFrame) {
    guard !working, let current = area, let size = imageSize else { return }
    let next = change(current)
    area = next
    error = nil
    UIAccessibility.post(notification: .announcement, argument: Self.sizeText(next, image: size))
  }

  private func reset() {
    guard let start = startArea, let size = imageSize else { return }
    area = start
    error = nil
    UIAccessibility.post(notification: .announcement, argument: Self.sizeText(start, image: size))
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
      if !isRedo, flow.photoCandidates.isEmpty { flow.photoCandidates = detail.candidates }
      originalURL = detail.originalUrl.flatMap(URL.init(string:))
      if area == nil { area = startArea }
    } catch {
      if APIError.isCancellation(error) { return }
      if imageSize == nil { self.error = error.localizedDescription }
    }
  }

  /// "Use this area": `cleanup` with the piece and the frame. The same piece and frame already cut
  /// (Back from Change it, then Use this area again) go on without a call. The result is written to
  /// the flow the request started with, even if the creator switched tabs meanwhile.
  private func useThisArea() async {
    let flow = flow
    guard let artwork, let area else { return }
    let pieceId = piece?.id
    if !isRedo, let cut = flow.pieceArtwork, cut.cleanedUrl != nil, flow.pieceCutFrom == pieceId, flow.pieceBox == area.box {
      if app.createPath.last == .adjustArea { app.push(.changeIt) }
      return
    }
    let request = CutoutRequest.make(piece: piece, area: area)
    working = true
    error = nil
    defer { working = false }
    do {
      let result = try await app.api.cleanup(artworkId: artwork.id, request)
      if isRedo {
        if flow.cutoutArtwork == nil { flow.cutoutArtwork = artwork }
        flow.recordCut(result)
        if let cut = flow.cutoutArtwork { app.designs.replace(cut) }
        guard app.designsPath.last == .adjustArea else { return }
        app.designsPath.removeLast()
        Task { await app.designs.load() }
      } else {
        var cut = result.artwork
        if cut.altText?.isEmpty ?? true { cut.altText = artwork.altText }
        flow.resetChange()
        flow.pieceArtwork = cut
        flow.pieceCutFrom = pieceId
        flow.pieceBox = area.box
        if app.createPath.last == .adjustArea { app.push(.changeIt) }
      }
    } catch {
      if let message = CleanupResult.errorMessage(for: error) { self.error = message }
    }
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
