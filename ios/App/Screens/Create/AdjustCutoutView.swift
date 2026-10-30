import SwiftUI

/// Adjust cutout: pick one or more of the pieces SAM found (thumbnail strip; numbered labels mark
/// them on the photo), add areas or leave pieces out with taps, or draw a box; "Apply cutout" saves
/// the cut on the server and shows it on a checkerboard; "Use this" goes on to Design ready.
/// Opened again from Design ready to redo it. All coordinates sent are pixels of the stored
/// original (`CreateFlow.imageSize`).
///
/// Taps on the photo: on a mark's dot it deletes that mark, anywhere else (also on a piece's
/// number label, which takes no taps) it adds a mark, so marks can sit close together.
///
/// VoiceOver: the thumbnail strip is the list of pieces (the labels on the photo are hidden from
/// it); each piece has actions for what the photo taps do ("Box around this piece", "Add the area
/// around this piece", "Leave this piece out"). The same actions are in the piece's context menu.
struct AdjustCutoutView: View {
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
      case .add: return "plus.circle"
      case .remove: return "minus.circle"
      case .box: return "rectangle.dashed"
      }
    }

    var instruction: LocalizedStringKey {
      switch self {
      case .add: return "Tap the photo where the cutout should include more. Tap a mark again to remove it."
      case .remove: return "Tap a piece to leave it out of the cutout. To trim one piece, draw a box around what should stay."
      case .box: return "Drag a box around the whole drawing."
      }
    }
  }

  /// A cut the server already saved, and what was sent for it.
  private struct Applied: Equatable {
    let request: CleanupRequest
    let result: CleanupResult
  }

  private enum Work { case apply, use }

  /// Where the screen was opened: the Create flow (new photo, or a redo from Design ready), or
  /// "Re-do the cutout" on a saved design (works on `AppState.designFlow`, comes back to the detail).
  enum Origin { case create, designs }

  var origin: Origin = .create

  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @State private var mode: Mode = .add
  @State private var work: Work?
  @State private var error: String?
  @State private var notice: String?
  @State private var applied: Applied?
  @State private var showingApplied = false
  @State private var dragStart: CGPoint?
  @State private var dragEnd: CGPoint?
  @State private var originalURL: URL?
  /// The pieces and marks of the cut the server has now: what was picked when a redo opened,
  /// then whatever "Apply cutout" saved. "Use this" with exactly that goes on without a call.
  @State private var savedRequest: CleanupRequest??

  var body: some View {
    FlowScreen(title: "Pick your art", subtitle: subtitle, step: isRedo ? nil : (2, 3), showsBack: work == nil) {
      VStack(spacing: Theme.Space.l) {
        if let size = imageSize {
          if let shown = shownApplied {
            appliedImage(shown.result.artwork, size: size)
          } else {
            photoArea(size: size)
          }
        } else if flow.photoArtwork != nil, error == nil {
          ProgressView().tint(colors.text).frame(minHeight: Theme.Size.record)
        }
        if let applied, applied.request == currentRequest {
          PillButton(shownApplied == nil ? "Show the cutout" : "Back to photo",
                     hint: shownApplied == nil ? "Shows the saved cutout on its own" : "Shows your photo with the marks again",
                     kind: .secondary, showsArrow: false) {
            showingApplied.toggle()
          }
        }
        if !candidates.isEmpty { candidateList }
        modePicker
        Text(mode.instruction)
          .themeFont(.bodyS)
          .foregroundStyle(colors.textMuted)
          .multilineTextAlignment(.center)
          .frame(maxWidth: .infinity)
          .accessibilityLabel(Text(mode.instruction) + Text(verbatim: " ") + Text("With VoiceOver, use the actions on each piece in the list instead."))
        if hasMarks {
          Button { clearMarks() } label: {
            Text("Clear marks")
              .themeFont(.body)
              .underline()
              .foregroundStyle(colors.text)
              .frame(minWidth: Theme.Size.iconButton, minHeight: Theme.Size.iconButton)
              .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .disabled(work != nil)
          .accessibilityHint(Text("Removes every mark and the box"))
        }
        if let notice {
          Text(notice)
            .themeFont(.body)
            .foregroundStyle(colors.text)
            .multilineTextAlignment(.center)
        }
        if let error { ErrorCard(message: error) }
      }
    } actions: {
      PillButton(work == .use ? "Cutting it out…" : "Use this", hint: "Uses this cutout and goes on") {
        start(.use) { await useThis() }
      }
      .disabled(currentAction == nil || work != nil)
      PillButton(work == .apply ? "Saving the cutout…" : "Apply cutout", hint: "Saves this cutout to your design and shows it", kind: .secondary, showsArrow: false) {
        start(.apply) { await apply() }
      }
      .disabled(currentRequest == nil || work != nil)
      SlowWorkHint(active: work != nil)
      if !isRedo {
        PillButton("Retake", hint: "Takes a new photo", kind: .secondary, showsArrow: false) {
          let source = flow.photoSource
          flow.discardPhoto()
          app.replaceTop(with: .camera(source))
        }
        .disabled(work != nil)
      }
    }
    .navigationBarBackButtonHidden(work != nil)
    .task { await loadDetailIfNeeded() }
    .onAppear {
      if savedRequest == nil { savedRequest = .some(isRedo ? currentRequest : nil) }
    }
    // A running request is not cancelled when the screen disappears (another tab, for instance):
    // the server saves the cut anyway, so the flow must still receive it. Back is hidden meanwhile.
  }

  // MARK: State

  /// The creation this screen edits.
  private var flow: CreateFlow { origin == .designs ? app.designFlow : app.flow }

  private var candidates: [Candidate] { flow.candidates }

  private var selected: [Candidate] {
    candidates.filter { flow.selectedCandidateIds.contains($0.id) }
  }

  private var hasMarks: Bool { !flow.points.isEmpty || flow.box != nil }

  /// Opened from Design ready ("Adjust cutout") or My designs: "Use this" goes back there.
  private var isRedo: Bool { origin == .designs || app.createPath.dropLast().last == .designReady }

  /// The server's size; falls back to the photo's pixels for an answer without a usable `imageSize`.
  private var imageSize: ImageSize? {
    if let size = flow.imageSize, size.isUsable { return size }
    guard let photo = flow.photo else { return nil }
    let size = ImageSize(w: photo.size.width * photo.scale, h: photo.size.height * photo.scale)
    return size.isUsable ? size : nil
  }

  private var currentRequest: CleanupRequest? {
    CutoutRequest.make(selected: selected, points: flow.points, box: flow.box)
  }

  private var currentAction: CutoutRequest.Action? {
    CutoutRequest.action(selected: selected, points: flow.points, box: flow.box, productsMayExist: isRedo)
  }

  /// The saved cut, while it still matches what is picked and the creator has not gone back to the photo.
  private var shownApplied: Applied? {
    guard showingApplied, let applied, applied.request == currentRequest else { return nil }
    return applied
  }

  private var subtitle: LocalizedStringKey {
    switch candidates.count {
    case 0: return "We couldn't find a drawing. Draw a box around it or tap on it."
    case 1: return "We found one piece. Change the cutout with the tools below."
    default: return "We found \(candidates.count) pieces. Pick one, or several to combine them."
    }
  }

  // MARK: Photo with chips, marks and box

  private func photoArea(size: ImageSize) -> some View {
    photoImage
      .aspectRatio(size.w / size.h, contentMode: .fit)
      .frame(maxWidth: .infinity)
      // Only the picture is clipped: a mark at the edge stays whole, overhanging the frame.
      .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m))
      .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.card))
      .overlay {
        GeometryReader { geo in
          let frame = CutoutGeometry.fitRect(image: size, in: geo.size)
          ZStack {
            gestureLayer(frame: frame, size: size)
            ForEach(candidates) { candidate in
              if let rect = CutoutGeometry.viewRect(box: candidate.bbox, shownIn: frame, image: size) {
                outline(rect: rect, selected: isSelected(candidate))
              }
            }
            if let box = flow.box, let rect = CutoutGeometry.viewRect(box: box, shownIn: frame, image: size) {
              boxOutline(rect: rect)
            }
            if let start = dragStart, let end = dragEnd {
              boxOutline(rect: CGRect(x: min(start.x, end.x), y: min(start.y, end.y), width: abs(end.x - start.x), height: abs(end.y - start.y)))
            }
            // Labels under the marks: a mark placed on a label stays visible.
            ForEach(Array(candidates.enumerated()), id: \.element.id) { index, candidate in
              if let rect = CutoutGeometry.viewRect(box: candidate.bbox, shownIn: frame, image: size) {
                chip(candidate, number: index + 1)
                  .position(chipCenter(for: rect, in: frame))
              }
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
      .accessibilityLabel(Text("Your photo"))
      .accessibilityIdentifier("cutout-photo")
  }

  @ViewBuilder private var photoImage: some View {
    if let photo = flow.photo {
      Image(uiImage: photo).resizable().scaledToFit()
    } else {
      RemoteImage(url: originalURL, altText: String(localized: "Your photo"))
    }
  }

  /// The only layer that takes touches on the photo (marks and labels take none). A tap on a mark's
  /// dot deletes it; any other tap adds a mark (Add / Remove area). In box mode a drag draws the box
  /// and a tap on a dot still deletes that mark.
  @ViewBuilder private func gestureLayer(frame: CGRect, size: ImageSize) -> some View {
    if mode == .box {
      // A UIKit pan: inside the screen's scroll view it wins over scrolling once it starts on the
      // photo (a SwiftUI DragGesture there lost the touch to the scroll view). A tap deletes the
      // mark under it.
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

  private func outline(rect: CGRect, selected: Bool) -> some View {
    RoundedRectangle(cornerRadius: Theme.Radius.s)
      .fill(selected ? colors.selected.opacity(ThemeEffects.selectionFillOpacity) : Color.clear)
      .overlay(
        RoundedRectangle(cornerRadius: Theme.Radius.s)
          .stroke(selected ? colors.selected : colors.surface,
                  style: StrokeStyle(lineWidth: Theme.Border.card, dash: selected ? [] : [Theme.Space.s, Theme.Space.xs]))
      )
      .frame(width: rect.width, height: rect.height)
      .position(x: rect.midX, y: rect.midY)
      .allowsHitTesting(false)
      .accessibilityHidden(true)
  }

  private func boxOutline(rect: CGRect) -> some View {
    Rectangle()
      .stroke(colors.primary, style: StrokeStyle(lineWidth: Theme.Border.card, dash: [Theme.Space.m, Theme.Space.xs]))
      .frame(width: rect.width, height: rect.height)
      .position(x: rect.midX, y: rect.midY)
      .allowsHitTesting(false)
      .accessibilityHidden(true)
  }

  /// Number label at the piece's top-left corner (kept inside the photo). It takes no taps, so a
  /// mark can be placed on it; pieces are picked in the strip below. Hidden from VoiceOver: the
  /// strip is the accessible list, so each piece is read once.
  private func chip(_ candidate: Candidate, number: Int) -> some View {
    let on = isSelected(candidate)
    return HStack(spacing: 0) {
      if on {
        Image(systemName: "checkmark").font(TextRole.caption.font.weight(.heavy))
      }
      Text("\(number)").themeFont(.caption)
    }
    .foregroundStyle(on ? colors.primaryText : colors.text)
    .padding(.horizontal, Theme.Space.xs)
    .frame(minWidth: Theme.Space.xxl, minHeight: Theme.Space.xxl)
    .background(Capsule().fill(on ? colors.primary : colors.surface))
    .overlay(Capsule().stroke(colors.border, lineWidth: Theme.Border.thin))
    .allowsHitTesting(false)
    .accessibilityHidden(true)
  }

  private func chipCenter(for rect: CGRect, in frame: CGRect) -> CGPoint {
    let half = Theme.Space.xxl / 2
    return CGPoint(x: min(max(rect.minX + half, frame.minX + half), max(frame.maxX - half, frame.minX + half)),
                   y: min(max(rect.minY + half, frame.minY + half), max(frame.maxY - half, frame.minY + half)))
  }

  /// A + or − mark. Touches go to the gesture layer (a tap on the dot deletes it); VoiceOver and
  /// Switch Control get a button with a 48 pt frame whose action deletes it.
  private func mark(_ point: CutoutPoint, index: Int) -> some View {
    let positive = point.label == .positive
    return Image(systemName: positive ? "plus" : "minus")
      .font(TextRole.caption.font.weight(.heavy))
      .foregroundStyle(positive ? colors.accentInk : colors.danger)
      .frame(width: Self.markDot, height: Self.markDot)
      .background(Circle().fill(positive ? colors.accent : colors.surface))
      .overlay(Circle().stroke(positive ? colors.border : colors.danger, lineWidth: Theme.Border.thin))
      .frame(width: Theme.Size.iconButton, height: Theme.Size.iconButton)
      .allowsHitTesting(false)
      .accessibilityElement(children: .ignore)
      .accessibilityAddTraits(.isButton)
      .accessibilityAction { removeMark(at: index) }
      .accessibilityLabel(positive ? Text("Added area, mark \(index + 1)") : Text("Left out, mark \(index + 1)"))
      .accessibilityHint(Text("Deletes this mark"))
  }

  private func appliedImage(_ artwork: Artwork, size: ImageSize) -> some View {
    ZStack {
      Checkerboard()
      RemoteImage(url: artwork.cleanedUrl.flatMap(URL.init(string:)), altText: artwork.altText ?? String(localized: "Your cutout"))
        .padding(Theme.Space.s)
    }
    .aspectRatio(size.w / size.h, contentMode: .fit)
    .frame(maxWidth: .infinity)
    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m))
    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.card))
    .accessibilityElement(children: .contain)
    .accessibilityIdentifier("cutout-applied")
  }

  // MARK: Thumbnails and mode picker

  /// The list of pieces: tap to pick; VoiceOver actions and the context menu do what the photo taps do.
  private var candidateList: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: Theme.Space.m) {
        ForEach(Array(candidates.enumerated()), id: \.element.id) { index, candidate in
          let on = isSelected(candidate)
          Button { toggle(candidate) } label: {
            VStack(spacing: Theme.Space.xs) {
              RemoteImage(url: candidate.thumbUrl.flatMap(URL.init(string:)), altText: nil)
                .frame(width: Theme.Size.record, height: Theme.Size.record)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.s))
              HStack(spacing: Theme.Space.xs) {
                Image(systemName: on ? "checkmark.square.fill" : "square")
                Text("Piece \(index + 1)").themeFont(.caption)
              }
              .foregroundStyle(colors.text)
            }
            .padding(Theme.Space.xs)
            .background(RoundedRectangle(cornerRadius: Theme.Radius.m).fill(on ? colors.selected : colors.surfaceAlt))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: on ? Theme.Border.card : Theme.Border.thin))
          }
          .buttonStyle(.plain)
          .disabled(work != nil)
          .accessibilityLabel(Text("Piece \(index + 1)"))
          .accessibilityValue(on ? Text(verbatim: "") : Text("Not selected"))
          .accessibilityHint(on ? Text("Leaves it out of the cutout") : Text("Adds it to the cutout"))
          .accessibilityAddTraits(on ? .isSelected : [])
          .accessibilityAction(named: Text("Box around this piece")) { boxAround(candidate) }
          .accessibilityAction(named: Text("Add the area around this piece")) { addAreaAround(candidate) }
          .accessibilityActions {
            if on { Button("Leave this piece out") { leaveOut(candidate) } }
          }
          .contextMenu {
            Button("Box around this piece") { boxAround(candidate) }
            Button("Add the area around this piece") { addAreaAround(candidate) }
            if on { Button("Leave this piece out") { leaveOut(candidate) } }
          }
        }
      }
      .padding(.vertical, Theme.Space.xs)
    }
  }

  private var modePicker: some View {
    let layout = dynamicTypeSize.isAccessibilitySize
      ? AnyLayout(VStackLayout(spacing: Theme.Space.xs))
      : AnyLayout(HStackLayout(spacing: Theme.Space.xs))
    return layout {
      ForEach(Mode.allCases, id: \.self) { item in
        let on = mode == item
        Button { mode = item } label: {
          VStack(spacing: Theme.Space.xs) {
            Image(systemName: item.symbol)
            Text(item.title).themeFont(.caption).multilineTextAlignment(.center)
          }
          .foregroundStyle(on ? colors.primaryText : colors.text)
          .padding(Theme.Space.xs)
          .frame(maxWidth: .infinity, minHeight: Theme.Size.iconButton)
          .background(RoundedRectangle(cornerRadius: Theme.Radius.s).fill(on ? colors.primary : colors.surface))
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(item.title))
        .accessibilityHint(Text("Then tap or drag on the photo. With VoiceOver, use the actions on each piece in the list."))
        .accessibilityAddTraits(on ? .isSelected : [])
      }
    }
    .disabled(work != nil)
    .padding(Theme.Space.xs)
    .background(RoundedRectangle(cornerRadius: Theme.Radius.m).fill(colors.surfaceAlt))
    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.thin))
  }

  // MARK: Editing

  private func isSelected(_ candidate: Candidate) -> Bool {
    flow.selectedCandidateIds.contains(candidate.id)
  }

  /// VoiceOver reads the new selected state itself, so nothing is announced here.
  private func toggle(_ candidate: Candidate) {
    guard work == nil else { return }
    var ids = Set(flow.selectedCandidateIds)
    if ids.contains(candidate.id) { ids.remove(candidate.id) } else { ids.insert(candidate.id) }
    flow.selectedCandidateIds = candidates.map(\.id).filter(ids.contains)
  }

  private func boxAround(_ candidate: Candidate) {
    guard let box = CutoutRequest.box(around: candidate) else { return }
    setBox(box)
  }

  private func addAreaAround(_ candidate: Candidate) {
    guard let point = CutoutRequest.centrePoint(of: candidate) else { return }
    addMark(point)
  }

  private func leaveOut(_ candidate: Candidate) {
    guard work == nil, isSelected(candidate) else { return }
    toggle(candidate)
    UIAccessibility.post(notification: .announcement, argument: String(localized: "Left out"))
  }

  private func setBox(_ box: [Double]) {
    guard work == nil else { return }
    flow.box = box
    notice = nil
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

  /// Without the local photo or a usable size (a redo after the photo is gone), fetch the artwork.
  private func loadDetailIfNeeded() async {
    let flow = flow
    guard let artwork = flow.photoArtwork, flow.photo == nil || imageSize == nil || flow.imageSize == nil else { return }
    do {
      let detail = try await app.api.artworkDetail(id: artwork.id)
      if flow.candidates.isEmpty { flow.candidates = detail.candidates }
      if let size = detail.imageSize, size.isUsable { flow.imageSize = size }
      originalURL = detail.originalUrl.flatMap(URL.init(string:))
    } catch {
      if APIError.isCancellation(error) { return }
      if flow.photo == nil || imageSize == nil { self.error = error.localizedDescription }
    }
  }

  /// "Apply cutout": the server saves the cut (and rebuilds products made from it), so the flow's
  /// artwork follows it right away.
  private func apply() async {
    let flow = flow
    guard let request = currentRequest, let artwork = flow.photoArtwork else { return }
    do {
      let result = try await app.api.cleanup(artworkId: artwork.id, request)
      record(result, in: flow)
      savedRequest = .some(request)
      applied = Applied(request: request, result: result)
      showingApplied = true
      notice = result.productNotice
      UIAccessibility.post(notification: .announcement, argument: String(localized: "Your cutout is saved. Here it is."))
    } catch {
      show(error, for: request)
    }
  }

  private func useThis() async {
    let flow = flow
    guard let action = currentAction, let artwork = flow.photoArtwork else { return }
    let redo = isRedo
    let request = currentRequest
    // The server already has this exact cut (opened with it, or Apply saved it): just go on.
    if case .some(let saved) = savedRequest, saved == request {
      leave(redo: redo)
      return
    }
    do {
      let result: CleanupResult
      switch action {
      case .select(let candidateId):
        result = CleanupResult(artwork: try await app.api.selectCandidate(artworkId: artwork.id, candidateId: candidateId))
      case .cleanup(let body):
        result = try await app.api.cleanup(artworkId: artwork.id, body)
      }
      record(result, in: flow)
      savedRequest = .some(request)
      leave(redo: redo)
    } catch {
      show(error, for: request)
    }
  }

  /// Written to the flow the request started with, even if the screen or tab changed meanwhile.
  private func record(_ result: CleanupResult, in flow: CreateFlow) {
    flow.artwork = result.artwork
    flow.cutoutNotice = result.productNotice
    if origin == .designs { app.designs.replace(result.artwork) }
  }

  private func show(_ error: Error, for request: CleanupRequest?) {
    if let message = CleanupResult.errorMessage(for: error, request: request) { self.error = message }
  }

  /// Goes on only if this screen is still on top (the creator may have left while it ran).
  private func leave(redo: Bool) {
    switch origin {
    case .designs:
      guard app.designsPath.last == .redoCutout else { return }
      app.designsPath.removeLast()
      Task { await app.designs.load() }
    case .create:
      guard app.createPath.last == .adjustCutout else { return }
      if redo {
        app.createPath.removeLast()
      } else {
        app.push(.designReady)
      }
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
