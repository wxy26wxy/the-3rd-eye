import SwiftUI

/// Board "Your cutout" (`2013:618`): the cut-out on a checkerboard ("Your cutout is ready. Here it
/// is."), then the edge tools (T131, back from v0.8-rc1 without "Draw a box": the Adjust the area
/// frame is the box): "Add area" / "Remove area" marks on the picture it was cut from ("Fix the
/// edges" shows that picture with the marks), "Clear marks"; pinned "Use this", "Apply cutout"
/// (cuts again with the marks and shows it) and "Start over" (back to Choose method).
///
/// Shown twice in a creation: after Adjust the area for the photo's piece ("Use this" → Change it),
/// and after a kept change for its cut-out ("Use this" → Making your sticker). Apply cutout sends
/// `cleanup {candidateIds: [the piece], points, box, clipToBox: true}` on that artwork; the box is
/// the frame on the photo, the whole picture after a change (`CutoutRequest.marks`). Coordinates are
/// pixels of that picture. Taps on the picture: on a mark's dot it deletes that mark, anywhere else
/// it adds one.
///
/// VoiceOver: the picture offers "Add the area around your art"; each mark is a button that deletes it.
struct YourCutoutView: View {
  enum Mode: CaseIterable, Hashable {
    case add, remove

    var title: LocalizedStringKey {
      switch self {
      case .add: return "Add area"
      case .remove: return "Remove area"
      }
    }

    var symbol: String {
      switch self {
      case .add: return "plus"
      case .remove: return "minus"
      }
    }

    var instruction: LocalizedStringKey {
      switch self {
      case .add: return "Tap the photo where the cutout should include more. Tap a mark again to remove it."
      case .remove: return "Tap the parts to leave out. Tap a mark again to remove it."
      }
    }
  }

  private enum Work { case apply, use }

  /// The artwork whose cut-out this is (the photo, or a change).
  let artworkId: String

  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @State private var mode: Mode = .add
  @State private var points: [CutoutPoint] = []
  /// The marks behind the cut the server has now ([] = the cut as it came).
  @State private var appliedPoints: [CutoutPoint] = []
  @State private var work: Work?
  @State private var error: String?
  @State private var notice: String?
  /// The cut-out is shown (on a checkerboard) instead of the picture with the marks.
  @State private var showingCutout = true
  @State private var originalURL: URL?
  @State private var loadedSize: ImageSize?

  private var flow: CreateFlow { app.flow }
  private var cut: Cut? { flow.cut(for: artworkId) }
  private var isPhoto: Bool { artworkId == flow.photoArtwork?.id }

  var body: some View {
    FlowScreen(title: "Your cutout", subtitle: subtitle, step: (3, 3), showsBack: work == nil) {
      VStack(spacing: Theme.Space.l) {
        if let cut {
          if showingCutout {
            cutoutImage(cut.artwork)
            Text("Your cutout is ready. Here it is.")
              .themeFont(.body)
              .foregroundStyle(colors.text)
              .multilineTextAlignment(.center)
              .frame(maxWidth: .infinity)
          } else if let size = imageSize {
            photoArea(size: size, cut: cut)
          } else if error == nil {
            ProgressView().tint(colors.text).frame(minHeight: Theme.Size.record)
          }
          tools
        } else {
          ErrorCard(message: String(localized: "Your art is missing. Go back and pick it again."))
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
      PillButton(work == .use ? "Cutting out your art…" : "Use this", hint: isPhoto ? "Goes on to change it or keep it as it is" : "Uses this cutout and makes your product") {
        start(.use) { await useThis() }
      }
      .disabled(cut == nil || work != nil)
      PillButton(work == .apply ? "Cutting out your art…" : "Apply cutout", hint: "Cuts it out again with your marks and shows it",
                 kind: .secondary, showsArrow: false) {
        start(.apply) { await apply() }
      }
      .disabled(currentRequest == nil || points == appliedPoints || work != nil)
      PillButton("Start over", hint: "Starts again from the choice of photo", kind: .secondary, showsArrow: false) {
        flow.discardPhoto()
        app.createPath = [.chooseMethod]
      }
      .disabled(work != nil)
      SlowWorkHint(active: work != nil)
    }
    .task { await loadPictureIfNeeded() }
    // A running request is not cancelled when the screen disappears (another tab, for instance):
    // the server saves the cut anyway, so the flow must still receive it. Back is hidden meanwhile.
  }

  // MARK: State

  private var subtitle: LocalizedStringKey {
    isPhoto ? "Here's the cutout of your art. Fix the edges if you need to."
            : "Here's the cutout of your changed art. Fix the edges if you need to."
  }

  /// Pixels of the picture the marks go on.
  private var imageSize: ImageSize? {
    if let size = cut?.imageSize, size.isUsable { return size }
    return loadedSize
  }

  /// The photo on this device, when the cut-out is the photo's piece.
  private var localPhoto: UIImage? { isPhoto ? flow.photo : nil }

  private var currentRequest: CleanupRequest? {
    guard var cut else { return nil }
    if cut.imageSize?.isUsable != true { cut.imageSize = loadedSize }
    return CutoutRequest.marks(points, on: cut)
  }

  private var piece: Candidate? {
    guard let cut else { return nil }
    return cut.candidates.first { cut.selected.contains($0.id) }
  }

  // MARK: Tools

  private var tools: some View {
    VStack(spacing: Theme.Space.l) {
      modePicker
      Text(mode.instruction)
        .themeFont(.body)
        .foregroundStyle(colors.textMuted)
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
      HStack(spacing: Theme.Space.xl) {
        if showingCutout {
          textAction("Fix the edges", hint: "Shows the picture so you can add marks") { showingCutout = false }
        }
        if !points.isEmpty {
          textAction("Clear marks", hint: "Removes every mark") { clearMarks() }
        }
      }
      .frame(maxWidth: .infinity)
    }
  }

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
        .accessibilityHint(Text("Then tap on the photo. With VoiceOver, use the actions on the photo."))
        .accessibilityAddTraits(on ? .isSelected : [])
      }
    }
    .disabled(work != nil)
    .opacity(work != nil ? Theme.Opacity.disabled : 1)
    .padding(Theme.Space.xs / 1.5)
    .background(RoundedRectangle(cornerRadius: Theme.Space.xxl, style: .continuous).fill(colors.surfaceAlt))
    .overlay(RoundedRectangle(cornerRadius: Theme.Space.xxl, style: .continuous).stroke(colors.border, lineWidth: Theme.Border.thin))
  }

  // MARK: Pictures

  private func cutoutImage(_ artwork: Artwork) -> some View {
    ZStack {
      Checkerboard()
      RemoteImage(url: artwork.cleanedUrl.flatMap(URL.init(string:)), altText: nil)
        .padding(Theme.Space.xl)
    }
    .aspectRatio(aspect, contentMode: .fit)
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

  /// The picture's own aspect when its size is known, else square.
  private var aspect: CGFloat {
    guard let size = imageSize else { return 1 }
    return size.w / size.h
  }

  private func photoArea(size: ImageSize, cut: Cut) -> some View {
    // The frame has the picture's own aspect whatever image loads, so view points map to
    // `imageSize` pixels exactly (`CutoutGeometry.fitRect`).
    Color.clear
      .aspectRatio(size.w / size.h, contentMode: .fit)
      .overlay { photoImage }
      // The picture is one VoiceOver element with the action the taps do: on the piece the cut-out
      // was made from, or on the whole picture when there is none.
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(Text("Your photo"))
      .accessibilityAddTraits(.isImage)
      .accessibilityActions {
        if let point = CutoutRequest.accessPoint(piece: piece, image: size) {
          Button("Add the area around your art") { addMark(point) }
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
            if let box = cut.box, let rect = CutoutGeometry.viewRect(box: box, shownIn: frame, image: size) {
              boxOutline(rect: rect)
            }
            ForEach(Array(points.enumerated()), id: \.offset) { index, point in
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
  /// deletes it; any other tap adds a mark of the chosen kind.
  private func gestureLayer(frame: CGRect, size: ImageSize) -> some View {
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

  /// The mark whose drawn dot is under `location`, if any (the nearest one when dots overlap).
  private func markIndex(at location: CGPoint, frame: CGRect, size: ImageSize) -> Int? {
    let centres = points.map { CutoutGeometry.viewPoint(x: $0.x, y: $0.y, shownIn: frame, image: size) }
    return CutoutGeometry.markIndex(at: location, centres: centres, radius: Self.markDot / 2)
  }

  /// Diameter of a mark's dot, which is also where a tap deletes it. Smaller than a 44 pt target
  /// on purpose, so a new mark can go right next to one (Clear marks and the VoiceOver action on
  /// each mark are the other ways to delete).
  private static let markDot = Theme.Space.xxl

  /// The box the marks are sent with (the Adjust the area frame), drawn dashed; not touchable.
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

  // MARK: Editing

  private func addMark(_ point: CutoutPoint) {
    guard work == nil else { return }
    guard points.count < CutoutRequest.maxPoints else {
      notice = String(localized: "You can add up to 10 marks. Tap a mark to remove it.")
      return
    }
    notice = nil
    error = nil
    points.append(point)
    UIAccessibility.post(notification: .announcement, argument: String(localized: "Mark added"))
  }

  private func removeMark(at index: Int) {
    guard work == nil, points.indices.contains(index) else { return }
    points.remove(at: index)
    notice = nil
    UIAccessibility.post(notification: .announcement, argument: String(localized: "Mark removed"))
  }

  private func clearMarks() {
    guard work == nil else { return }
    points = []
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

  /// The picture the marks go on: the local photo, else the stored picture (`GET /artworks/{id}`,
  /// presigned), whose size also comes from there when the cut has none.
  private func loadPictureIfNeeded() async {
    guard cut != nil, localPhoto == nil || imageSize == nil else { return }
    do {
      let detail = try await app.api.artworkDetail(id: artworkId)
      if let size = detail.imageSize, size.isUsable { loadedSize = size }
      if !isPhoto, flow.changeCuts[artworkId]?.candidates.isEmpty == true, !detail.candidates.isEmpty {
        flow.changeCuts[artworkId]?.candidates = detail.candidates
        flow.changeCuts[artworkId]?.selected = [detail.candidates[0].id]
      }
      originalURL = detail.originalUrl.flatMap(URL.init(string:))
    } catch {
      if APIError.isCancellation(error) { return }
      if imageSize == nil { self.error = error.localizedDescription }
    }
  }

  /// "Apply cutout": the server cuts again with the marks, and the flow's cut-out follows it right
  /// away. Written to the flow the request started with, even if the screen or tab changed.
  private func apply() async {
    let flow = flow
    guard let request = currentRequest else { return }
    let sent = points
    do {
      let result = try await app.api.cleanup(artworkId: artworkId, request)
      var cut = result.artwork
      if cut.altText?.isEmpty ?? true { cut.altText = flow.cut(for: artworkId)?.artwork.altText }
      if cut.spokenDescription?.isEmpty ?? true { cut.spokenDescription = flow.cut(for: artworkId)?.artwork.spokenDescription }
      flow.recordCut(of: artworkId, cut)
      flow.cutoutNotice = result.productNotice
      appliedPoints = sent
      showingCutout = true
      notice = result.productNotice
      UIAccessibility.post(notification: .announcement, argument: String(localized: "Your cutout is ready. Here it is."))
    } catch {
      if let message = CleanupResult.errorMessage(for: error, request: request) { self.error = message }
    }
  }

  /// "Use this": marks not applied yet are applied first; then on (only while this screen is on top).
  private func useThis() async {
    if points != appliedPoints, currentRequest != nil {
      await apply()
      guard error == nil else { return }
    }
    guard app.createPath.last == .yourCutout(artworkId), let next = flow.routeAfterCutout(of: artworkId) else { return }
    app.push(next)
  }
}
