import SwiftUI

/// Adjust cutout: pick one or more of the pieces SAM found (numbered chips on the photo and a
/// thumbnail strip), add areas or leave pieces out with taps, or draw a box; "Apply cutout" saves
/// the cut on the server and shows it on a checkerboard; "Use this" goes on to Design ready.
/// Opened again from Design ready to redo it. All coordinates sent are pixels of the stored
/// original (`CreateFlow.imageSize`).
///
/// VoiceOver: the thumbnail strip is the list of pieces (the chips on the photo are hidden from
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

  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @State private var mode: Mode = .add
  @State private var work: Work?
  @State private var task: Task<Void, Never>?
  @State private var error: String?
  @State private var notice: String?
  @State private var applied: Applied?
  @State private var showingApplied = false
  @State private var dragStart: CGPoint?
  @State private var dragEnd: CGPoint?
  @State private var originalURL: URL?
  @State private var detailFailed = false
  /// What was picked when a redo opened, so "Use this" without changes just goes back.
  @State private var openedWith: CleanupRequest??

  var body: some View {
    FlowScreen(title: "Pick your art", subtitle: subtitle, step: isRedo ? nil : (2, 3), showsBack: work == nil) {
      VStack(spacing: Theme.Space.l) {
        if let size = imageSize {
          if let shown = shownApplied {
            appliedImage(shown.result.artwork, size: size)
          } else {
            photoArea(size: size)
          }
        } else if app.flow.photoArtwork != nil, error == nil {
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
          app.replaceTop(with: .camera(app.flow.photoSource))
        }
        .disabled(work != nil)
      }
    }
    .navigationBarBackButtonHidden(work != nil)
    .task { await loadDetailIfNeeded() }
    .onAppear {
      if openedWith == nil { openedWith = .some(isRedo ? currentRequest : nil) }
    }
    .onDisappear {
      task?.cancel()
      task = nil
    }
  }

  // MARK: State

  private var candidates: [Candidate] { app.flow.candidates }

  private var selected: [Candidate] {
    candidates.filter { app.flow.selectedCandidateIds.contains($0.id) }
  }

  private var hasMarks: Bool { !app.flow.points.isEmpty || app.flow.box != nil }

  /// Opened from Design ready ("Adjust cutout"): "Use this" goes back there.
  private var isRedo: Bool { app.createPath.dropLast().last == .designReady }

  /// The server's size; falls back to the photo's pixels for an answer without a usable `imageSize`.
  private var imageSize: ImageSize? {
    if let size = app.flow.imageSize, size.isUsable { return size }
    guard let photo = app.flow.photo else { return nil }
    let size = ImageSize(w: photo.size.width * photo.scale, h: photo.size.height * photo.scale)
    return size.isUsable ? size : nil
  }

  private var currentRequest: CleanupRequest? {
    CutoutRequest.make(selected: selected, points: app.flow.points, box: app.flow.box)
  }

  private var currentAction: CutoutRequest.Action? {
    CutoutRequest.action(selected: selected, points: app.flow.points, box: app.flow.box, productsMayExist: isRedo)
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
            if let box = app.flow.box, let rect = CutoutGeometry.viewRect(box: box, shownIn: frame, image: size) {
              boxOutline(rect: rect)
            }
            if let start = dragStart, let end = dragEnd {
              boxOutline(rect: CGRect(x: min(start.x, end.x), y: min(start.y, end.y), width: abs(end.x - start.x), height: abs(end.y - start.y)))
            }
            ForEach(Array(app.flow.points.enumerated()), id: \.offset) { index, point in
              mark(point, index: index)
                .position(CutoutGeometry.viewPoint(x: point.x, y: point.y, shownIn: frame, image: size))
            }
            ForEach(Array(candidates.enumerated()), id: \.element.id) { index, candidate in
              if let rect = CutoutGeometry.viewRect(box: candidate.bbox, shownIn: frame, image: size) {
                chip(candidate, number: index + 1)
                  .position(chipCenter(for: rect, in: frame))
              }
            }
          }
          .disabled(work != nil)
        }
      }
      .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m))
      .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.card))
      .accessibilityElement(children: .contain)
      .accessibilityLabel(Text("Your photo"))
      .accessibilityIdentifier("cutout-photo")
  }

  @ViewBuilder private var photoImage: some View {
    if let photo = app.flow.photo {
      Image(uiImage: photo).resizable().scaledToFit()
    } else {
      RemoteImage(url: originalURL, altText: String(localized: "Your photo"))
    }
  }

  /// Taps add marks; in box mode a drag draws the box.
  @ViewBuilder private func gestureLayer(frame: CGRect, size: ImageSize) -> some View {
    if mode == .box {
      Color.clear
        .contentShape(Rectangle())
        .gesture(
          DragGesture(minimumDistance: Theme.Space.xs)
            .onChanged { value in
              dragStart = value.startLocation
              dragEnd = value.location
            }
            .onEnded { value in
              dragStart = nil
              dragEnd = nil
              guard let box = CutoutGeometry.imageBox(from: value.startLocation, to: value.location, shownIn: frame, image: size) else { return }
              setBox(box)
            }
        )
    } else {
      Color.clear
        .contentShape(Rectangle())
        .gesture(SpatialTapGesture().onEnded { value in
          let p = CutoutGeometry.imagePoint(value.location, shownIn: frame, image: size)
          addMark(CutoutPoint(x: p.x, y: p.y, label: mode == .remove ? .negative : .positive))
        })
    }
  }

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

  /// Numbered chip at the piece's top-left corner (kept inside the photo). Hidden from
  /// VoiceOver: the thumbnail strip is the accessible list, so each piece is read once.
  private func chip(_ candidate: Candidate, number: Int) -> some View {
    let on = isSelected(candidate)
    return Button { toggle(candidate) } label: {
      HStack(spacing: 0) {
        if on {
          Image(systemName: "checkmark").font(TextRole.caption.font.weight(.heavy))
        }
        Text("\(number)").themeFont(.caption)
      }
      .foregroundStyle(on ? colors.primaryText : colors.text)
      .padding(.horizontal, Theme.Space.s)
      .frame(minHeight: Theme.Size.iconButton - Theme.Space.s)
      .background(Capsule().fill(on ? colors.primary : colors.surface))
      .overlay(Capsule().stroke(colors.border, lineWidth: Theme.Border.thin))
      .frame(minWidth: Theme.Size.iconButton, minHeight: Theme.Size.iconButton)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityHidden(true)
  }

  private func chipCenter(for rect: CGRect, in frame: CGRect) -> CGPoint {
    let half = Theme.Size.iconButton / 2
    return CGPoint(x: min(max(rect.minX + half, frame.minX + half), max(frame.maxX - half, frame.minX + half)),
                   y: min(max(rect.minY + half, frame.minY + half), max(frame.maxY - half, frame.minY + half)))
  }

  /// A + or − mark: 48 pt target, tap to remove.
  private func mark(_ point: CutoutPoint, index: Int) -> some View {
    let positive = point.label == .positive
    return Button { removeMark(at: index) } label: {
      Image(systemName: positive ? "plus" : "minus")
        .font(TextRole.caption.font.weight(.heavy))
        .foregroundStyle(positive ? colors.accentInk : colors.danger)
        .frame(width: Theme.Space.xxl, height: Theme.Space.xxl)
        .background(Circle().fill(positive ? colors.accent : colors.surface))
        .overlay(Circle().stroke(positive ? colors.border : colors.danger, lineWidth: Theme.Border.thin))
        .frame(width: Theme.Size.iconButton, height: Theme.Size.iconButton)
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
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
          .accessibilityAction(named: Text("Leave this piece out")) { leaveOut(candidate) }
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
    app.flow.selectedCandidateIds.contains(candidate.id)
  }

  /// VoiceOver reads the new selected state itself, so nothing is announced here.
  private func toggle(_ candidate: Candidate) {
    guard work == nil else { return }
    var ids = Set(app.flow.selectedCandidateIds)
    if ids.contains(candidate.id) { ids.remove(candidate.id) } else { ids.insert(candidate.id) }
    app.flow.selectedCandidateIds = candidates.map(\.id).filter(ids.contains)
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
    app.flow.box = box
    notice = nil
    UIAccessibility.post(notification: .announcement, argument: String(localized: "Box drawn"))
  }

  private func addMark(_ point: CutoutPoint) {
    guard work == nil else { return }
    guard app.flow.points.count < CutoutRequest.maxPoints else {
      notice = String(localized: "You can add up to 10 marks. Tap a mark to remove it.")
      return
    }
    let points = app.flow.points + [point]
    if point.label == .negative, CutoutRequest.leavesNothing(selected: selected, points: points, box: app.flow.box) {
      notice = CleanupResult.removeAdvice
      UIAccessibility.post(notification: .announcement, argument: CleanupResult.removeAdvice)
      return
    }
    notice = nil
    app.flow.points = points
    UIAccessibility.post(notification: .announcement, argument: String(localized: "Mark added"))
  }

  private func removeMark(at index: Int) {
    guard work == nil, app.flow.points.indices.contains(index) else { return }
    app.flow.points.remove(at: index)
    notice = nil
    UIAccessibility.post(notification: .announcement, argument: String(localized: "Mark removed"))
  }

  private func clearMarks() {
    guard work == nil else { return }
    app.flow.points = []
    app.flow.box = nil
    notice = nil
  }

  // MARK: Requests

  /// Runs one request at a time; the handle is cancelled when the screen goes away.
  private func start(_ kind: Work, _ operation: @escaping @MainActor () async -> Void) {
    guard work == nil else { return }
    work = kind
    error = nil
    task = Task { @MainActor in
      await operation()
      work = nil
      task = nil
    }
  }

  /// Without the local photo or a usable size (a redo after the photo is gone), fetch the artwork.
  private func loadDetailIfNeeded() async {
    guard let artwork = app.flow.photoArtwork, app.flow.photo == nil || imageSize == nil || app.flow.imageSize == nil else { return }
    do {
      let detail = try await app.api.artworkDetail(id: artwork.id)
      if app.flow.candidates.isEmpty { app.flow.candidates = detail.candidates }
      if let size = detail.imageSize, size.isUsable { app.flow.imageSize = size }
      originalURL = detail.originalUrl.flatMap(URL.init(string:))
    } catch {
      if APIError.isCancellation(error) { return }
      if app.flow.photo == nil || imageSize == nil { self.error = error.localizedDescription }
    }
  }

  /// "Apply cutout": the server saves the cut (and rebuilds products made from it), so the flow's
  /// artwork follows it right away.
  private func apply() async {
    guard let request = currentRequest, let artwork = app.flow.photoArtwork else { return }
    do {
      let result = try await app.api.cleanup(artworkId: artwork.id, request)
      record(result)
      applied = Applied(request: request, result: result)
      showingApplied = true
      notice = result.productNotice
      UIAccessibility.post(notification: .announcement, argument: String(localized: "Your cutout is saved. Here it is."))
    } catch {
      show(error)
    }
  }

  private func useThis() async {
    guard let action = currentAction, let artwork = app.flow.photoArtwork else { return }
    let redo = isRedo
    let request = currentRequest
    if let applied, applied.request == request {
      leave(redo: redo)
      return
    }
    if redo, case .some(let opened) = openedWith, opened == request {
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
      record(result)
      leave(redo: redo)
    } catch {
      show(error)
    }
  }

  private func record(_ result: CleanupResult) {
    app.flow.artwork = result.artwork
    app.flow.cutoutNotice = result.productNotice
  }

  private func show(_ error: Error) {
    if APIError.isCancellation(error) { return }
    if case APIError.server(422, _, _) = error {
      self.error = CleanupResult.removeAdvice
    } else {
      self.error = error.localizedDescription
    }
  }

  /// Goes on only if this screen is still on top (the creator may have left while it ran).
  private func leave(redo: Bool) {
    guard app.createPath.last == .adjustCutout else { return }
    if redo {
      app.createPath.removeLast()
    } else {
      app.push(.designReady)
    }
  }
}
