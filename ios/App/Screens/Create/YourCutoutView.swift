import SwiftUI

/// Board "Your cutout" (`2013:618`): the cut-out on a checkerboard ("Your cutout is ready. Here it
/// is."), then the edge tools: "Add area" / "Remove area" / "Draw a box" on the picture it was cut
/// from ("Fix the edges" shows that picture with the marks), "Clear marks"; pinned "Use this"
/// (goes on to Making your sticker), "Apply cutout" (saves the new cut and shows it) and "Start
/// over" (a new photo). Also "Re-do the cutout" on a saved design (`origin: .designs`), where
/// "Use this" goes back to the design.
///
/// Every request sends the piece the cut-out was made from (`candidateIds`) with the marks and the
/// box (docs/api.md T080 §2, T111 §2); coordinates are pixels of that picture (`CreateFlow.imageSize`).
/// Taps on the picture: on a mark's dot it deletes that mark, anywhere else it adds one.
///
/// VoiceOver: the picture offers "Box around your art" and "Add the area around your art"; each
/// mark is a button that deletes it.
struct YourCutoutView: View {
  enum Mode: CaseIterable, Hashable {
    case add, remove, box

    var title: LocalizedStringKey {
      switch self {
      case .add: return "Add area"
      case .remove: return "Remove area"
      case .box: return "Draw a box"
      }
    }

    var symbol: String {
      switch self {
      case .add: return "plus"
      case .remove: return "minus"
      case .box: return "square.dashed"
      }
    }

    var instruction: LocalizedStringKey {
      switch self {
      case .add: return "Tap the photo where the cutout should include more. Tap a mark again to remove it."
      case .remove: return "Draw a box around what should stay, then tap the parts to leave out."
      case .box: return "Drag a box around the whole drawing."
      }
    }
  }

  private enum Work { case apply, use }

  /// Where the screen was opened: the Create flow, or "Re-do the cutout" on a saved design (works
  /// on `AppState.designFlow`, comes back to the detail).
  enum Origin { case create, designs }

  var origin: Origin = .create

  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @State private var mode: Mode = .add
  @State private var work: Work?
  @State private var error: String?
  @State private var notice: String?
  /// The cut-out is shown (on a checkerboard) instead of the picture with the marks.
  @State private var showingCutout = true
  @State private var dragStart: CGPoint?
  @State private var dragEnd: CGPoint?
  @State private var originalURL: URL?
  /// The request behind the cut the server has now (`.some(nil)`: the cut as opened, no request);
  /// nil until the screen knows. "Use this" with exactly that goes on without a call.
  @State private var savedRequest: CleanupRequest??

  var body: some View {
    FlowScreen(title: "Your cutout", subtitle: subtitle, step: isRedo ? nil : (3, 3), showsBack: work == nil) {
      VStack(spacing: Theme.Space.l) {
        if let size = imageSize {
          if showsCutout, let artwork = flow.cutoutArtwork {
            cutoutImage(artwork, size: size)
          } else {
            photoArea(size: size)
          }
        } else if error == nil {
          ProgressView().tint(colors.text).frame(minHeight: Theme.Size.record)
        }
        if showsCutout {
          Text("Your cutout is ready. Here it is.")
            .themeFont(.body)
            .foregroundStyle(colors.text)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
        }
        modePicker
        Text(mode.instruction)
          .themeFont(.body)
          .foregroundStyle(colors.textMuted)
          .multilineTextAlignment(.center)
          .frame(maxWidth: .infinity)
        HStack(spacing: Theme.Space.xl) {
          if showsCutout {
            textAction("Fix the edges", hint: "Shows the picture so you can add marks or a box") { showingCutout = false }
          }
          if hasMarks {
            textAction("Clear marks", hint: "Removes every mark and the box") { clearMarks() }
          }
        }
        .frame(maxWidth: .infinity)
        if let notice {
          Text(notice)
            .themeFont(.body)
            .foregroundStyle(colors.text)
            .multilineTextAlignment(.center)
        }
        if let error { ErrorCard(message: error) }
      }
    } actions: {
      PillButton(work == .use ? "Cutting out your art…" : "Use this", hint: isRedo ? "Uses this cutout for your design" : "Uses this cutout and makes your product") {
        start(.use) { await useThis() }
      }
      .disabled(!canUse || work != nil)
      PillButton(work == .apply ? "Cutting out your art…" : "Apply cutout", hint: "Cuts it out again with your marks and shows it",
                 kind: .secondary, showsArrow: false) {
        start(.apply) { await apply() }
      }
      .disabled(currentRequest == nil || cutIsCurrent || work != nil)
      if !isRedo {
        PillButton("Start over", hint: "Starts again from the camera", kind: .secondary, showsArrow: false) {
          let source = flow.photoSource
          flow.discardPhoto()
          app.createPath = [.chooseMethod, .camera(source)]
        }
        .disabled(work != nil)
      }
      SlowWorkHint(active: work != nil)
    }
    .navigationBarBackButtonHidden(work != nil)
    .task { await loadPictureIfNeeded() }
    .onAppear {
      if savedRequest == nil { savedRequest = .some(flow.cutoutArtwork?.cleanedUrl != nil ? currentRequest : nil) }
      if flow.cutoutArtwork?.cleanedUrl == nil { showingCutout = false }
    }
    // A running request is not cancelled when the screen disappears (another tab, for instance):
    // the server saves the cut anyway, so the flow must still receive it. Back is hidden meanwhile.
  }

  // MARK: State

  /// The creation this screen edits.
  private var flow: CreateFlow { origin == .designs ? app.designFlow : app.flow }

  private var selected: [Candidate] {
    flow.candidates.filter { flow.selectedCandidateIds.contains($0.id) }
  }

  private var hasMarks: Bool { !flow.points.isEmpty || flow.box != nil }

  private var isRedo: Bool { origin == .designs }

  private var showsCutout: Bool { showingCutout && flow.cutoutArtwork?.cleanedUrl != nil }

  private var subtitle: LocalizedStringKey {
    if flow.cutoutArtwork?.cleanedUrl == nil { return "Draw a box around your art, or tap it, then tap Apply cutout." }
    return flow.cutoutArtwork?.parentArtworkId != nil
      ? "Here's the cutout of your changed art. Fix the edges if you need to."
      : "Here's the cutout of your art. Fix the edges if you need to."
  }

  /// The server's size; for the local photo it falls back to the photo's pixels.
  private var imageSize: ImageSize? {
    if let size = flow.imageSize, size.isUsable { return size }
    guard let photo = localPhoto else { return nil }
    let size = ImageSize(w: photo.size.width * photo.scale, h: photo.size.height * photo.scale)
    return size.isUsable ? size : nil
  }

  /// The photo on this device, when the cut-out is made from it (not from a changed picture).
  private var localPhoto: UIImage? {
    flow.cutoutArtwork?.id == flow.photoArtwork?.id ? flow.photo : nil
  }

  /// What the creator composed; with nothing marked and no cut-out yet (no drawing found), the
  /// whole photo (ruling, T114 fix round 1).
  private var currentRequest: CleanupRequest? {
    CutoutRequest.make(selected: selected, points: flow.points, box: flow.box)
      ?? CutoutRequest.wholePhoto(hasCut: flow.cutoutArtwork?.cleanedUrl != nil, selected: selected, image: imageSize)
  }

  /// The cut the server has matches the marks and box on screen.
  private var cutIsCurrent: Bool {
    guard flow.cutoutArtwork?.cleanedUrl != nil, case .some(let saved) = savedRequest else { return false }
    return saved == currentRequest
  }

  private var canUse: Bool { cutIsCurrent || currentRequest != nil }

  // MARK: Pictures

  private func cutoutImage(_ artwork: Artwork, size: ImageSize) -> some View {
    ZStack {
      Checkerboard()
      RemoteImage(url: artwork.cleanedUrl.flatMap(URL.init(string:)), altText: nil)
        .padding(Theme.Space.xl)
    }
    .aspectRatio(size.w / size.h, contentMode: .fit)
    .frame(maxHeight: Theme.photoMaxHeight)
    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous).stroke(colors.border, lineWidth: Theme.Border.card))
    .contentShape(Rectangle())
    .onTapGesture { if work == nil { showingCutout = false } }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text("Your cutout") + Text(verbatim: ": ") + Text(artwork.altText ?? ""))
    .accessibilityAddTraits(.isImage)
    .accessibilityIdentifier("cutout-applied")
    .frame(maxWidth: .infinity)
  }

  private func photoArea(size: ImageSize) -> some View {
    // The frame has the picture's own aspect whatever image loads (a placeholder, a picture of
    // another size), so view points map to `imageSize` pixels exactly (`CutoutGeometry.fitRect`).
    Color.clear
      .aspectRatio(size.w / size.h, contentMode: .fit)
      .overlay { photoImage }
      // The picture is one VoiceOver element with the actions the taps do (T114 fix round 1): on
      // the piece the cut-out was made from, or on the whole photo when no drawing was found.
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(Text("Your photo"))
      .accessibilityAddTraits(.isImage)
      .accessibilityActions {
        if let target = CutoutRequest.accessTarget(piece: selected.first, image: size) {
          Button("Box around your art") { setBox(target.box) }
          Button("Add the area around your art") { addMark(target.point) }
        }
      }
      .frame(maxHeight: Theme.photoMaxHeight - 2 * ThemeEffects.photoCardInset)
      // Only the picture is clipped: a mark at the edge stays whole, overhanging the frame.
      .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.s))
      .softShadow()
      .overlay {
        GeometryReader { geo in
          let frame = CutoutGeometry.fitRect(image: size, in: geo.size)
          ZStack {
            gestureLayer(frame: frame, size: size)
            if let box = flow.box, let rect = CutoutGeometry.viewRect(box: box, shownIn: frame, image: size) {
              boxOutline(rect: rect)
            }
            if let start = dragStart, let end = dragEnd {
              boxOutline(rect: CGRect(x: min(start.x, end.x), y: min(start.y, end.y), width: abs(end.x - start.x), height: abs(end.y - start.y)))
            }
            ForEach(Array(flow.points.enumerated()), id: \.offset) { index, point in
              mark(point, index: index)
                .position(CutoutGeometry.viewPoint(x: point.x, y: point.y, shownIn: frame, image: size))
            }
          }
          .disabled(work != nil)
        }
      }
      .accessibilityElement(children: .contain)
      .accessibilityIdentifier("cutout-photo")
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

  /// The only layer that takes touches on the picture (marks take none). A tap on a mark's dot
  /// deletes it; any other tap adds a mark (Add / Remove area). In box mode a drag draws the box
  /// and a tap on a dot still deletes that mark.
  @ViewBuilder private func gestureLayer(frame: CGRect, size: ImageSize) -> some View {
    if mode == .box {
      // A UIKit pan: inside the screen's scroll view it wins over scrolling once it starts on the
      // picture (a SwiftUI DragGesture there lost the touch to the scroll view).
      BoxDragSurface(
        changed: { start, current in
          dragStart = start
          dragEnd = current
        },
        ended: { start, end in
          dragStart = nil
          dragEnd = nil
          guard let box = CutoutGeometry.imageBox(from: start, to: end, shownIn: frame, image: size) else { return }
          setBox(box)
        },
        tapped: { location in
          if let index = markIndex(at: location, frame: frame, size: size) { removeMark(at: index) }
        }
      )
    } else {
      Color.clear
        .contentShape(Rectangle())
        .gesture(SpatialTapGesture().onEnded { value in
          if let index = markIndex(at: value.location, frame: frame, size: size) {
            removeMark(at: index)
            return
          }
          let p = CutoutGeometry.imagePoint(value.location, shownIn: frame, image: size)
          addMark(CutoutPoint(x: p.x, y: p.y, label: mode == .remove ? .negative : .positive))
        })
    }
  }

  /// The mark whose drawn dot is under `location`, if any (the nearest one when dots overlap).
  private func markIndex(at location: CGPoint, frame: CGRect, size: ImageSize) -> Int? {
    let centres = flow.points.map { CutoutGeometry.viewPoint(x: $0.x, y: $0.y, shownIn: frame, image: size) }
    return CutoutGeometry.markIndex(at: location, centres: centres, radius: Self.markDot / 2)
  }

  /// Diameter of a mark's dot, which is also where a tap deletes it. Smaller than a 44 pt target
  /// on purpose, so a new mark can go right next to one (Clear marks and the VoiceOver action on
  /// each mark are the other ways to delete).
  private static let markDot = Theme.Space.xxl

  private func boxOutline(rect: CGRect) -> some View {
    Rectangle()
      .stroke(colors.primary, style: StrokeStyle(lineWidth: Theme.Border.card, dash: [Theme.Space.m, Theme.Space.xs]))
      .frame(width: rect.width, height: rect.height)
      .position(x: rect.midX, y: rect.midY)
      .allowsHitTesting(false)
      .accessibilityHidden(true)
  }

  /// A + or − mark. Touches go to the gesture layer (a tap on the dot deletes it); VoiceOver and
  /// Switch Control get a button with a 48 pt frame whose action deletes it.
  private func mark(_ point: CutoutPoint, index: Int) -> some View {
    let positive = point.label == .positive
    // Board marks: an ink dot with a white ring and the mark's number; a "left out" mark is red with a minus.
    return Group {
      if positive {
        Text("\(index + 1)").themeFont(.caption)
      } else {
        Image(systemName: "minus").font(TextRole.caption.font.weight(.heavy))
      }
    }
      .foregroundStyle(colors.primaryText)
      .minimumScaleFactor(ThemeEffects.minimumTextScale)
      .frame(width: Self.markDot, height: Self.markDot)
      .background(Circle().fill(positive ? colors.primary : colors.danger))
      .overlay(Circle().stroke(colors.surface, lineWidth: ThemeEffects.selectedStroke))
      .frame(width: Theme.Size.iconButton, height: Theme.Size.iconButton)
      .allowsHitTesting(false)
      .accessibilityElement(children: .ignore)
      .accessibilityAddTraits(.isButton)
      .accessibilityAction { removeMark(at: index) }
      .accessibilityLabel(positive ? Text("Added area, mark \(index + 1)") : Text("Left out, mark \(index + 1)"))
      .accessibilityHint(Text("Deletes this mark"))
  }

  // MARK: Tools

  /// Centred text action (Figma `Text action`), 44 pt tall.
  private func textAction(_ title: LocalizedStringKey, hint: LocalizedStringKey, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Text(title)
        .themeFont(.body)
        .underline()
        .foregroundStyle(colors.text)
        .frame(minWidth: Theme.Size.iconButton, minHeight: Theme.Size.iconButton)
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .disabled(work != nil)
    .opacity(work != nil ? Theme.Opacity.disabled : 1)
    .accessibilityHint(Text(hint))
  }

  private var modePicker: some View {
    let layout = dynamicTypeSize.isAccessibilitySize
      ? AnyLayout(VStackLayout(spacing: Theme.Space.xs))
      : AnyLayout(HStackLayout(spacing: Theme.Space.xs))
    return layout {
      ForEach(Mode.allCases, id: \.self) { item in
        let on = mode == item
        Button {
          mode = item
          showingCutout = false
        } label: {
          // Figma `Segmented control`: 64 pt segments, the selected one ink with white text.
          VStack(spacing: Theme.Space.xs) {
            Image(systemName: item.symbol).font(TextRole.titleL.font)
            Text(item.title).themeFont(.body).fontWeight(TextRole.caption.weight).multilineTextAlignment(.center)
          }
          .foregroundStyle(on ? colors.primaryText : colors.text)
          .padding(Theme.Space.xs)
          .frame(maxWidth: .infinity, minHeight: ThemeEffects.segmentHeight)
          .background(RoundedRectangle(cornerRadius: Theme.Radius.m + 2, style: .continuous).fill(on ? colors.primary : Color.clear))
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(item.title))
        .accessibilityHint(Text("Then tap or drag on the photo. With VoiceOver, use the actions on the photo."))
        .accessibilityAddTraits(on ? .isSelected : [])
      }
    }
    .disabled(work != nil)
    .opacity(work != nil ? Theme.Opacity.disabled : 1)
    .padding(Theme.Space.xs / 1.5)
    .background(RoundedRectangle(cornerRadius: Theme.Space.xxl, style: .continuous).fill(colors.surfaceAlt))
    .overlay(RoundedRectangle(cornerRadius: Theme.Space.xxl, style: .continuous).stroke(colors.border, lineWidth: Theme.Border.thin))
  }

  // MARK: Editing

  private func setBox(_ box: [Double]) {
    guard work == nil else { return }
    flow.box = box
    notice = nil
    showingCutout = false
    UIAccessibility.post(notification: .announcement, argument: String(localized: "Box drawn"))
  }

  private func addMark(_ point: CutoutPoint) {
    guard work == nil else { return }
    guard flow.points.count < CutoutRequest.maxPoints else {
      notice = String(localized: "You can add up to 10 marks. Tap a mark to remove it.")
      return
    }
    let points = flow.points + [point]
    if point.label == .negative, CutoutRequest.leavesNothing(selected: selected, points: points, box: flow.box) {
      notice = CleanupResult.removeAdvice
      UIAccessibility.post(notification: .announcement, argument: CleanupResult.removeAdvice)
      return
    }
    notice = nil
    flow.points = points
    UIAccessibility.post(notification: .announcement, argument: String(localized: "Mark added"))
  }

  private func removeMark(at index: Int) {
    guard work == nil, flow.points.indices.contains(index) else { return }
    flow.points.remove(at: index)
    notice = nil
    UIAccessibility.post(notification: .announcement, argument: String(localized: "Mark removed"))
  }

  private func clearMarks() {
    guard work == nil else { return }
    flow.points = []
    flow.box = nil
    notice = nil
  }

  // MARK: Requests

  /// Runs one request at a time. It keeps running if the screen goes away (see `body`).
  private func start(_ kind: Work, _ operation: @escaping @MainActor () async -> Void) {
    guard work == nil else { return }
    work = kind
    error = nil
    Task { @MainActor in
      await operation()
      work = nil
    }
  }

  /// The picture the marks go on: the local photo, else the stored original (`GET /artworks/{id}`,
  /// presigned), whose size also comes from there when the flow has none.
  private func loadPictureIfNeeded() async {
    let flow = flow
    guard let artwork = flow.cutoutArtwork, localPhoto == nil || flow.imageSize == nil else { return }
    do {
      let detail = try await app.api.artworkDetail(id: artwork.id)
      if flow.candidates.isEmpty, !detail.candidates.isEmpty {
        flow.candidates = detail.candidates
        if flow.selectedCandidateIds.isEmpty, detail.candidates.count == 1 { flow.selectedCandidateIds = detail.candidates.map(\.id) }
      }
      if let size = detail.imageSize, size.isUsable { flow.imageSize = size }
      originalURL = detail.originalUrl.flatMap(URL.init(string:))
    } catch {
      if APIError.isCancellation(error) { return }
      if imageSize == nil { self.error = error.localizedDescription }
    }
  }

  /// "Apply cutout": the server cuts again (and rebuilds products made from it, on a redo), so the
  /// flow's cut-out follows it right away.
  private func apply() async {
    let flow = flow
    guard let request = currentRequest, let artwork = flow.cutoutArtwork else { return }
    do {
      let result = try await app.api.cleanup(artworkId: artwork.id, request)
      record(result, in: flow)
      savedRequest = .some(request)
      showingCutout = true
      notice = result.productNotice
      UIAccessibility.post(notification: .announcement, argument: String(localized: "Your cutout is ready. Here it is."))
    } catch {
      show(error, for: request)
    }
  }

  private func useThis() async {
    let flow = flow
    guard let artwork = flow.cutoutArtwork else { return }
    if cutIsCurrent {
      leave(with: artwork)
      return
    }
    guard let request = currentRequest else { return }
    do {
      let result = try await app.api.cleanup(artworkId: artwork.id, request)
      record(result, in: flow)
      savedRequest = .some(request)
      leave(with: result.artwork)
    } catch {
      show(error, for: request)
    }
  }

  /// Written to the flow the request started with, even if the screen or tab changed meanwhile.
  private func record(_ result: CleanupResult, in flow: CreateFlow) {
    flow.recordCut(result)
    if origin == .designs, let cut = flow.cutoutArtwork { app.designs.replace(cut) }
  }

  private func show(_ error: Error, for request: CleanupRequest?) {
    if let message = CleanupResult.errorMessage(for: error, request: request) { self.error = message }
  }

  /// Goes on only if this screen is still on top (the creator may have left while it ran).
  private func leave(with artwork: Artwork) {
    switch origin {
    case .designs:
      guard app.designsPath.last == .redoCutout else { return }
      app.designsPath.removeLast()
      Task { await app.designs.load() }
    case .create:
      guard app.createPath.last == .yourCutout else { return }
      flow.artwork = artwork
      app.push(.makingProduct)
    }
  }
}

/// Box mode's touch surface: a pan draws the box, a tap reports its location. Coordinates are
/// in this view's space, which fills the photo overlay like the SwiftUI layers above it.
private struct BoxDragSurface: UIViewRepresentable {
  let changed: (CGPoint, CGPoint) -> Void
  let ended: (CGPoint, CGPoint) -> Void
  let tapped: (CGPoint) -> Void

  func makeUIView(context: Context) -> UIView {
    let view = UIView()
    view.backgroundColor = .clear
    let pan = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.pan(_:)))
    pan.maximumNumberOfTouches = 1
    view.addGestureRecognizer(pan)
    view.addGestureRecognizer(UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tap(_:))))
    return view
  }

  func updateUIView(_ uiView: UIView, context: Context) {
    context.coordinator.surface = self
    // SwiftUI's `.disabled` does not reach UIKit recognisers: follow it here (no drag while a
    // request runs).
    uiView.isUserInteractionEnabled = context.environment.isEnabled
  }

  func makeCoordinator() -> Coordinator { Coordinator(surface: self) }

  @MainActor
  final class Coordinator: NSObject {
    var surface: BoxDragSurface
    private var start: CGPoint?

    init(surface: BoxDragSurface) { self.surface = surface }

    @objc func pan(_ recognizer: UIPanGestureRecognizer) {
      let location = recognizer.location(in: recognizer.view)
      switch recognizer.state {
      case .began:
        let origin = CGPoint(x: location.x - recognizer.translation(in: recognizer.view).x,
                             y: location.y - recognizer.translation(in: recognizer.view).y)
        start = origin
        surface.changed(origin, location)
      case .changed:
        if let start { surface.changed(start, location) }
      case .ended:
        if let start { surface.ended(start, location) }
        start = nil
      default:
        if let start { surface.ended(start, start) }
        start = nil
      }
    }

    @objc func tap(_ recognizer: UITapGestureRecognizer) {
      surface.tapped(recognizer.location(in: recognizer.view))
    }
  }
}

