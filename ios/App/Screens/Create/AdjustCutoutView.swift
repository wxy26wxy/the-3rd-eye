import SwiftUI

/// Adjust cutout: pick one or more of the pieces SAM found (numbered chips on the photo and a
/// thumbnail strip), add or remove areas with taps, or draw a box; preview the cut-out on a
/// checkerboard; "Use this" goes on to Design ready. Opened again from Design ready to redo it.
/// All coordinates sent are pixels of the stored original (`CreateFlow.imageSize`).
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
      case .remove: return "Tap the photo where the cutout should leave something out. Tap a mark again to remove it."
      case .box: return "Drag a box around the whole drawing."
      }
    }
  }

  private struct Preview: Equatable {
    let request: CleanupRequest
    let result: CleanupResult
  }

  private enum Work { case preview, use }

  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @State private var mode: Mode = .add
  @State private var work: Work?
  @State private var error: String?
  @State private var notice: String?
  @State private var preview: Preview?
  @State private var showingPreview = false
  @State private var dragStart: CGPoint?
  @State private var dragEnd: CGPoint?
  @State private var originalURL: URL?

  var body: some View {
    FlowScreen(title: "Pick your art", subtitle: subtitle, step: isRedo ? nil : (2, 3)) {
      VStack(spacing: Theme.Space.l) {
        if let size = imageSize {
          if let shown = shownPreview {
            previewImage(shown.result.artwork, size: size)
          } else {
            photoArea(size: size)
          }
        } else if app.flow.photoArtwork != nil, error == nil {
          ProgressView().tint(colors.text).frame(minHeight: Theme.Size.record)
        }
        if let preview, preview.request == currentRequest {
          PillButton(shownPreview == nil ? "Show the preview" : "Back to photo",
                     hint: shownPreview == nil ? "Shows the cutout on its own" : "Shows your photo with the marks again",
                     kind: .secondary, showsArrow: false) {
            showingPreview.toggle()
          }
        }
        if !candidates.isEmpty { candidateList }
        modePicker
        Text(mode.instruction)
          .themeFont(.bodyS)
          .foregroundStyle(colors.textMuted)
          .multilineTextAlignment(.center)
          .frame(maxWidth: .infinity)
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
      PillButton(work == .use ? "Cutting it out…" : "Use this", hint: "Cuts out what you picked and goes on") {
        Task { await useThis() }
      }
      .disabled(currentAction == nil || work != nil)
      PillButton(work == .preview ? "Making the preview…" : "Preview cutout", hint: "Shows the cutout before you use it", kind: .secondary, showsArrow: false) {
        Task { await runPreview() }
      }
      .disabled(currentRequest == nil || work != nil)
      SlowWorkHint(active: work != nil)
      if !isRedo {
        PillButton("Retake", hint: "Takes a new photo", kind: .secondary, showsArrow: false) {
          app.replaceTop(with: .camera(app.flow.photoSource))
        }
      }
    }
    .task { await loadDetailIfNeeded() }
  }

  // MARK: State

  private var candidates: [Candidate] { app.flow.candidates }

  private var selected: [Candidate] {
    candidates.filter { app.flow.selectedCandidateIds.contains($0.id) }
  }

  private var hasMarks: Bool { !app.flow.points.isEmpty || app.flow.box != nil }

  /// Opened from Design ready ("Adjust cutout"): "Use this" goes back there.
  private var isRedo: Bool { app.createPath.dropLast().last == .designReady }

  /// The server's size; falls back to the photo's pixels for an answer without `imageSize`.
  private var imageSize: ImageSize? {
    if let size = app.flow.imageSize { return size }
    guard let photo = app.flow.photo else { return nil }
    return ImageSize(w: photo.size.width * photo.scale, h: photo.size.height * photo.scale)
  }

  private var currentRequest: CleanupRequest? {
    CutoutRequest.make(selected: selected, points: app.flow.points, box: app.flow.box)
  }

  private var currentAction: CutoutRequest.Action? {
    CutoutRequest.action(selected: selected, points: app.flow.points, box: app.flow.box)
  }

  /// The preview, while it still matches what is picked and the creator has not gone back to the photo.
  private var shownPreview: Preview? {
    guard showingPreview, let preview, preview.request == currentRequest else { return nil }
    return preview
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
          let frame = CGRect(origin: .zero, size: geo.size)
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
              app.flow.box = box
              UIAccessibility.post(notification: .announcement, argument: String(localized: "Box drawn"))
            }
        )
    } else {
      Color.clear
        .contentShape(Rectangle())
        .gesture(SpatialTapGesture().onEnded { value in addMark(at: value.location, frame: frame, size: size) })
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

  /// Numbered chip at the piece's top-left corner (kept inside the photo); a checkbox.
  private func chip(_ candidate: Candidate, number: Int) -> some View {
    let on = isSelected(candidate)
    return Button { toggle(candidate) } label: {
      HStack(spacing: 0) {
        if on {
          Image(systemName: "checkmark").font(TextRole.caption.font.weight(.heavy)).accessibilityHidden(true)
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
    .modifier(CandidateToggleSemantics(number: number, selected: on))
  }

  private func chipCenter(for rect: CGRect, in frame: CGRect) -> CGPoint {
    let half = Theme.Size.iconButton / 2
    return CGPoint(x: min(max(rect.minX + half, half), max(frame.maxX - half, half)),
                   y: min(max(rect.minY + half, half), max(frame.maxY - half, half)))
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
    .accessibilityLabel(positive ? Text("Added area, mark \(index + 1)") : Text("Removed area, mark \(index + 1)"))
    .accessibilityHint(Text("Deletes this mark"))
  }

  private func previewImage(_ artwork: Artwork, size: ImageSize) -> some View {
    ZStack {
      Checkerboard()
      RemoteImage(url: artwork.cleanedUrl.flatMap(URL.init(string:)), altText: artwork.altText ?? String(localized: "Cutout preview"))
        .padding(Theme.Space.s)
    }
    .aspectRatio(size.w / size.h, contentMode: .fit)
    .frame(maxWidth: .infinity)
    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m))
    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.card))
    .accessibilityElement(children: .contain)
    .accessibilityIdentifier("cutout-preview")
  }

  // MARK: Thumbnails and mode picker

  /// Thumbnails as a second, list-shaped way to pick (easier with VoiceOver and Switch Control).
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
                Image(systemName: on ? "checkmark.square.fill" : "square").accessibilityHidden(true)
                Text("Piece \(index + 1)").themeFont(.caption)
              }
              .foregroundStyle(colors.text)
            }
            .padding(Theme.Space.xs)
            .background(RoundedRectangle(cornerRadius: Theme.Radius.m).fill(on ? colors.selected : colors.surfaceAlt))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: on ? Theme.Border.card : Theme.Border.thin))
          }
          .buttonStyle(.plain)
          .modifier(CandidateToggleSemantics(number: index + 1, selected: on))
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
            Image(systemName: item.symbol).accessibilityHidden(true)
            Text(item.title).themeFont(.caption).multilineTextAlignment(.center)
          }
          .foregroundStyle(on ? colors.primaryText : colors.text)
          .padding(Theme.Space.xs)
          .frame(maxWidth: .infinity, minHeight: Theme.Size.iconButton)
          .background(RoundedRectangle(cornerRadius: Theme.Radius.s).fill(on ? colors.primary : colors.surface))
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(item.title))
        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
      }
    }
    .padding(Theme.Space.xs)
    .background(RoundedRectangle(cornerRadius: Theme.Radius.m).fill(colors.surfaceAlt))
    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.thin))
    .accessibilityElement(children: .contain)
    .accessibilityLabel(Text("What a tap on the photo does"))
  }

  // MARK: Actions

  private func isSelected(_ candidate: Candidate) -> Bool {
    app.flow.selectedCandidateIds.contains(candidate.id)
  }

  private func toggle(_ candidate: Candidate) {
    var ids = Set(app.flow.selectedCandidateIds)
    let nowOn = !ids.contains(candidate.id)
    if nowOn { ids.insert(candidate.id) } else { ids.remove(candidate.id) }
    app.flow.selectedCandidateIds = candidates.map(\.id).filter(ids.contains)
    UIAccessibility.post(notification: .announcement, argument: nowOn ? String(localized: "Selected") : String(localized: "Not selected"))
  }

  private func addMark(at location: CGPoint, frame: CGRect, size: ImageSize) {
    guard app.flow.points.count < CutoutRequest.maxPoints else {
      notice = String(localized: "You can add up to 10 marks. Tap a mark to remove it.")
      return
    }
    notice = nil
    let p = CutoutGeometry.imagePoint(location, shownIn: frame, image: size)
    app.flow.points.append(CutoutPoint(x: p.x, y: p.y, label: mode == .remove ? .negative : .positive))
    UIAccessibility.post(notification: .announcement, argument: String(localized: "Mark added"))
  }

  private func removeMark(at index: Int) {
    guard app.flow.points.indices.contains(index) else { return }
    app.flow.points.remove(at: index)
    notice = nil
    UIAccessibility.post(notification: .announcement, argument: String(localized: "Mark removed"))
  }

  private func clearMarks() {
    app.flow.points = []
    app.flow.box = nil
    notice = nil
  }

  /// Without the local photo or the server's size (a redo after the photo is gone), fetch the artwork.
  private func loadDetailIfNeeded() async {
    guard let artwork = app.flow.photoArtwork, app.flow.photo == nil || app.flow.imageSize == nil else { return }
    do {
      let detail = try await app.api.artworkDetail(id: artwork.id)
      if app.flow.candidates.isEmpty { app.flow.candidates = detail.candidates }
      if let size = detail.imageSize { app.flow.imageSize = size }
      originalURL = detail.originalUrl.flatMap(URL.init(string:))
    } catch is CancellationError {
      return
    } catch {
      if imageSize == nil { self.error = error.localizedDescription }
    }
  }

  private func runPreview() async {
    guard let request = currentRequest, let artwork = app.flow.photoArtwork else { return }
    work = .preview
    error = nil
    defer { work = nil }
    do {
      let result = try await app.api.cleanup(artworkId: artwork.id, request)
      preview = Preview(request: request, result: result)
      showingPreview = true
      notice = result.productNotice
      UIAccessibility.post(notification: .announcement, argument: String(localized: "Here is the preview of your cutout."))
    } catch is CancellationError {
      return
    } catch {
      self.error = error.localizedDescription
    }
  }

  private func useThis() async {
    guard let action = currentAction, let artwork = app.flow.photoArtwork else { return }
    if case .cleanup(let request) = action, let preview, preview.request == request {
      finish(preview.result)
      return
    }
    work = .use
    error = nil
    defer { work = nil }
    do {
      switch action {
      case .select(let candidateId):
        finish(CleanupResult(artwork: try await app.api.selectCandidate(artworkId: artwork.id, candidateId: candidateId)))
      case .cleanup(let request):
        finish(try await app.api.cleanup(artworkId: artwork.id, request))
      }
    } catch is CancellationError {
      return
    } catch {
      self.error = error.localizedDescription
    }
  }

  private func finish(_ result: CleanupResult) {
    app.flow.artwork = result.artwork
    app.flow.cutoutNotice = result.productNotice
    if isRedo {
      app.createPath.removeLast()
    } else {
      app.push(.designReady)
    }
  }
}

/// Checkbox semantics for a candidate chip or thumbnail: "Piece 2, selected, button".
private struct CandidateToggleSemantics: ViewModifier {
  let number: Int
  let selected: Bool

  func body(content: Content) -> some View {
    content
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(Text("Piece \(number)"))
      .accessibilityValue(selected ? Text("") : Text("Not selected"))
      .accessibilityHint(selected ? Text("Double-tap to leave it out of the cutout") : Text("Double-tap to add it to the cutout"))
      .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
  }
}
