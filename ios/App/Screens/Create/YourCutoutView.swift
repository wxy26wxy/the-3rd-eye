import SwiftUI

/// Board "Your cutout" (`2013:618`): the cut-out on a checkerboard ("Your cutout is ready. Here it
/// is."), then the edge tools (T131, back from v0.8-rc1 without "Draw a box": the Adjust the area
/// frame is the box): "Add area" / "Remove area" marks on the picture it was cut from ("Fix the
/// edges" shows that picture with the marks), "Clear marks"; pinned "Use this", "Apply cutout"
/// (cuts again with the marks and shows it) and "Start over" (back to Choose method).
///
/// Shown after Adjust the area for the crop's piece, and from "Fix the cutout" (Change it, Before
/// and after) or Listing "Redo" for the art on screen; "Use this" goes to Change it (back to the one
/// it was opened from), which shows the product photo, rebuilt by the `cleanup` (its `products`). Apply cutout sends
/// `cleanup {candidateIds: [the piece], points, box, clipToBox: true}` on that artwork; round 4: the
/// picture is the stored crop (or the change), so the box is always the whole picture and no frame
/// is drawn. Coordinates are pixels of that picture (`imageSize`). Taps on the picture: on a mark's
/// dot it deletes that mark, anywhere else it adds one.
///
/// Round 3: when the crop (or a change's `cutout`) has several drawings, a strip of them sits under
/// the picture. One drawing: no strip. T155: a tap is local: the piece is selected and the stage
/// shows its own cut (`Candidate.cleanedUrl`, preloaded through the image cache) with no request; a
/// piece whose cut is not ready is read again once after 2 s, then picked the old way. "Use this"
/// sends `cleanup {candidateIds: [it], box, clipToBox: true}` only when the selected piece is not
/// the one the row was cut from (`Cut.pendingPick`); marks go with the selected piece.
///
/// "Re-do the cutout" on a saved design opens it in My designs (`origin: .designs`, the design
/// flow): marks on the stored crop, "Use this" goes back to the design, "Take a new photo" starts a
/// new creation (the server has no uncropped photo to frame again).
///
/// VoiceOver: the picture offers "Add the area around your art"; each mark is a button that deletes
/// it; the strip is a list of buttons ("Piece n", selected trait).
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

  private enum Work { case apply, use, pick }

  /// The Create flow, or "Re-do the cutout" on a saved design (`AppState.designFlow`).
  enum Origin { case create, designs }

  /// The artwork whose cut-out this is (the photo, or a change).
  let artworkId: String
  var origin: Origin = .create

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
  /// T155: VoiceOver stays on the tapped chip (a tap is local; nothing is announced).
  @AccessibilityFocusState private var focusedPiece: String?

  private var isRedo: Bool { origin == .designs }
  private var flow: CreateFlow { isRedo ? app.designFlow : app.flow }
  private var cut: Cut? { flow.cut(for: artworkId) }
  private var isPhoto: Bool { artworkId == flow.photoArtwork?.id }
  /// The cut exists (a saved design that was never cut shows the picture for marks first).
  private var hasCut: Bool { cut?.artwork.cleanedUrl != nil }
  /// No local photo to frame again (a saved design, or a draft continued from My designs): the
  /// way back is a new photo.
  private var offersNewPhoto: Bool { isRedo || app.flow.photo == nil }

  var body: some View {
    FlowScreen(title: "Your cutout", subtitle: subtitle, step: isRedo ? nil : (3, 3), showsBack: work == nil) {
      VStack(spacing: Theme.Space.l) {
        if let cut {
          if showingCutout && hasCut {
            cutoutImage(cut)
            // T155: not while a tapped piece's cut is still being made (the stage shows a spinner).
            if cut.stageUrl != nil {
              Text("Your cutout is ready. Here it is.")
                .themeFont(.body)
                .foregroundStyle(colors.text)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
            }
          } else if let size = imageSize {
            photoArea(size: size, cut: cut)
          } else if error == nil {
            ProgressView().tint(colors.text).frame(minHeight: Theme.Size.record)
          }
          if Self.showsStrip(cut) { strip(cut) }
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
      PillButton(work == .use ? "Cutting out your art…" : "Use this", hint: isRedo ? "Saves this cutout and goes back to your design" : "Goes on to change it or keep it as it is") {
        start(.use) { await useThis() }
      }
      .disabled(!hasCut || work != nil)
      PillButton(work == .apply ? "Cutting out your art…" : "Apply cutout", hint: "Cuts it out again with your marks and shows it",
                 kind: .secondary, showsArrow: false) {
        start(.apply) { await apply() }
      }
      .disabled(currentRequest == nil || points == appliedPoints || work != nil)
      if offersNewPhoto {
        PillButton("Take a new photo", hint: "Starts again with another photo", kind: .secondary, showsArrow: false) {
          takeNewPhoto()
        }
        .disabled(work != nil)
      } else {
        PillButton("Start over", hint: "Starts again from the choice of photo", kind: .secondary, showsArrow: false) {
          flow.discardPhoto()
          app.createPath = [.chooseMethod]
        }
        .disabled(work != nil)
      }
      SlowWorkHint(active: work != nil)
    }
    .task { await loadPictureIfNeeded() }
    .task(id: pieceCutURLs) { preloadPieceCuts() }
    // T155 review: Back drops a pick that was never sent (a tab switch keeps the path, and the pick).
    .onDisappear {
      let open = isRedo ? app.designsPath.contains(.yourCutout(artworkId)) : app.createPath.contains(.yourCutout(artworkId))
      if !open { flow.forgetPick(for: artworkId) }
    }
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

  private var currentRequest: CleanupRequest? {
    guard let cut = sizedCut else { return nil }
    return CutoutRequest.marks(points, on: cut)
  }

  /// The cut with the stored picture's size filled in from `GET /artworks/{id}` when the flow has
  /// none, so the marks and the pick (T155) are built on the same box.
  private var sizedCut: Cut? {
    guard var cut else { return nil }
    if cut.imageSize?.isUsable != true { cut.imageSize = loadedSize }
    return cut
  }

  private var piece: Candidate? {
    guard let cut else { return nil }
    return cut.candidates.first { cut.selected.contains($0.id) }
  }

  /// The strip of drawings shows only when there are several to choose from (round 3).
  static func showsStrip(_ cut: Cut) -> Bool { cut.candidates.count >= 2 }

  /// Picking another drawing on the strip: the same frame (the whole picture after a change), no marks.
  static func pick(_ candidate: Candidate, on cut: Cut) -> CleanupRequest? {
    CutoutRequest.pick(candidate, on: cut)
  }

  /// The strip's own cuts (T155), loaded ahead so a tap shows the piece at once.
  private var pieceCutURLs: [URL] {
    guard let cut, Self.showsStrip(cut) else { return [] }
    return cut.candidates.compactMap { $0.cleanedUrl.flatMap(URL.init(string:)) }
  }

  private func preloadPieceCuts() {
    for url in pieceCutURLs where ImageLoader.shared.cachedImage(for: url) == nil {
      Task { _ = try? await ImageLoader.shared.image(for: url) }
    }
  }

  // MARK: Strip

  private func strip(_ cut: Cut) -> some View {
    VStack(alignment: .leading, spacing: Theme.Space.xs) {
      Text("We found \(cut.candidates.count) drawings in the frame. Tap the one you want.")
        .themeFont(.body)
        .foregroundStyle(colors.text)
        .fixedSize(horizontal: false, vertical: true)
      ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: Theme.Space.m) {
          ForEach(Array(cut.candidates.enumerated()), id: \.element.id) { index, candidate in
            pieceChip(candidate, index: index, on: cut.selected.first == candidate.id)
          }
        }
        .padding(.vertical, Theme.Space.xs)
      }
    }
    .disabled(work != nil)
    .accessibilityElement(children: .contain)
    .accessibilityIdentifier("cutout-strip")
  }

  /// Figma `Piece chip`: 80 pt white thumbnail; picked = 2 pt ink border and a check badge, not
  /// picked = 1 pt border and dimmed art. "Piece n" under it.
  private func pieceChip(_ candidate: Candidate, index: Int, on: Bool) -> some View {
    let shape = RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
    return Button {
      // The picked chip again does nothing, except on a cut with marks: it shows the piece's raw cut.
      guard !on || (flow.markedCuts.contains(artworkId) && cut?.pickIsPending == false) else { return }
      pick(candidate)
    } label: {
      VStack(spacing: Theme.Space.xs) {
        RemoteImage(url: candidate.thumbUrl.flatMap(URL.init(string:)), altText: nil)
          .padding(Theme.Space.xs)
          .opacity(on ? 1 : ThemeEffects.unselectedPieceOpacity)
          .frame(width: ThemeEffects.pieceThumb, height: ThemeEffects.pieceThumb)
          .background(shape.fill(colors.surface))
          .clipShape(shape)
          .overlay(shape.strokeBorder(on ? colors.text : colors.border, lineWidth: on ? ThemeEffects.selectedStroke : Theme.Border.thin))
          .overlay(alignment: .topTrailing) {
            if on { CheckBadge(size: Theme.Size.radio).offset(x: Theme.Space.xs, y: -Theme.Space.s + 2) }
          }
        Text("Piece \(index + 1)").themeFont(.body).fontWeight(TextRole.caption.weight).foregroundStyle(colors.text)
      }
      .padding(.top, Theme.Space.s)
      .padding(.trailing, Theme.Space.xs)
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text("Piece \(index + 1)"))
    .accessibilityValue(on ? Text(verbatim: "") : Text("Not selected"))
    .accessibilityHint(on ? Text(verbatim: "") : Text("Picks this drawing"))
    .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
    .accessibilityIdentifier("piece-\(index + 1)")
    .accessibilityFocused($focusedPiece, equals: candidate.id)
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
        if showingCutout && hasCut {
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

  private func cutoutImage(_ cut: Cut) -> some View {
    let artwork = cut.artwork
    let index = cut.candidates.firstIndex { $0.id == cut.selected.first }
    return ZStack {
      Checkerboard()
      if let url = cut.stageUrl.flatMap(URL.init(string:)) {
        RemoteImage(url: url, altText: nil)
          .padding(Theme.Space.xl)
      } else {
        // T155: the tapped piece's cut is still being made (read again after 2 s).
        ProgressView().tint(colors.text)
      }
    }
    .aspectRatio(aspect, contentMode: .fit)
    .frame(maxHeight: Theme.photoMaxHeight)
    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous).stroke(colors.border, lineWidth: Theme.Border.card))
    .contentShape(Rectangle())
    .onTapGesture { if work == nil { showingCutout = false } }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(cut.pickIsPending ? Text("Your cutout")
                        : Text("Your cutout") + Text(verbatim: ": ") + Text(artwork.altText ?? ""))
    .accessibilityValue(Self.showsStrip(cut) && index != nil ? Text("Piece \((index ?? 0) + 1)") : Text(verbatim: ""))
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

  /// The stored picture (round 4: the crop, never the whole local photo), from `GET /artworks/{id}`.
  private var photoImage: some View {
    RemoteImage(url: originalURL, altText: String(localized: "Your photo"))
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

  // MARK: Strip pick (T155)

  /// A strip tap: the piece is selected and its own cut is on the stage, with no request. The marks
  /// were on the old piece and go. A cut not ready yet is read again once, then picked the old way.
  private func pick(_ candidate: Candidate) {
    guard work == nil, let sized = sizedCut, CutoutRequest.pick(candidate, on: sized) != nil else { return }
    flow.pickPiece(candidate.id, for: artworkId)
    focusedPiece = candidate.id
    points = []
    appliedPoints = []
    notice = nil
    error = nil
    showingCutout = true
    guard let cut = sizedCut, cut.pickIsPending, cut.stageUrl == nil else { return }
    let flow = flow
    let api = app.api
    let artworkId = artworkId
    start(.pick) {
      guard let request = await flow.awaitPieceCut(candidate.id, for: artworkId, api: api) else { return }
      await apply(request, picked: true, announces: false)
    }
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

  /// The picture the marks go on: the stored picture (`GET /artworks/{id}`, presigned; cached by its
  /// path), whose size also comes from there when the cut has none.
  private func loadPictureIfNeeded() async {
    guard cut != nil, originalURL == nil else { return }
    do {
      let detail = try await app.api.artworkDetail(id: artworkId)
      if let size = detail.imageSize, size.isUsable { loadedSize = size }
      if isPhoto, let size = detail.imageSize, size.isUsable, flow.photoImageSize?.isUsable != true { flow.photoImageSize = size }
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
    guard let request = currentRequest else { return }
    await apply(request, picked: false)
  }

  /// Sends `request` (the marks, or another drawing picked on the strip, which drops the marks and,
  /// on the photo, the changes made from the old piece).
  /// The "Your cutout is ready" announcement is made after Apply cutout and Use this only (T155:
  /// not for a strip tap, even when its cut had to be asked for).
  private func apply(_ request: CleanupRequest, picked: Bool, announces: Bool = true) async {
    let flow = flow
    let sent = picked ? [] : points
    do {
      let result = try await app.api.cleanup(artworkId: artworkId, request)
      var cut = result.artwork
      if cut.altText?.isEmpty ?? true { cut.altText = flow.cut(for: artworkId)?.artwork.altText }
      if cut.spokenDescription?.isEmpty ?? true { cut.spokenDescription = flow.cut(for: artworkId)?.artwork.spokenDescription }
      // Another piece (a pick, or marks on a newly selected piece) drops the changes of the old one.
      if isPhoto, let id = request.candidateIds?.first, id != flow.pieceCutFrom { flow.resetChange() }
      flow.recordCut(of: artworkId, cut, request: request)
      // Ruling 2 (T143): the products rebuilt from the new cut come with the answer.
      flow.applyRebuilt(result.products, for: cut)
      if flow.artwork?.id == artworkId { flow.artwork = cut }
      flow.cutoutNotice = result.productNotice
      if isRedo {
        flow.cutoutArtwork = cut
        app.designs.replace(cut)
      }
      if picked { points = [] }
      appliedPoints = sent
      showingCutout = true
      notice = result.productNotice
      if announces { UIAccessibility.post(notification: .announcement, argument: String(localized: "Your cutout is ready. Here it is.")) }
    } catch {
      if let message = CleanupResult.errorMessage(for: error, request: request) { self.error = message }
    }
  }

  /// "Use this": marks not applied yet are applied first (with the selected piece); else, when the
  /// selected piece is not the one the row was cut from, the pick is sent (T155); then on (only
  /// while this screen is on top). A saved design goes back to its detail, which shows the new cut.
  private func useThis() async {
    if points != appliedPoints, currentRequest != nil {
      await apply()
      guard error == nil else { return }
    } else if let pick = sizedCut?.pendingPick {
      await apply(pick, picked: true)
      guard error == nil else { return }
    }
    if isRedo {
      guard app.designsPath.last == .yourCutout(artworkId) else { return }
      app.designsPath.removeLast()
      Task { await app.designs.load(force: true) }
      return
    }
    guard app.createPath.last == .yourCutout(artworkId), let next = flow.routeAfterCutout(of: artworkId) else { return }
    // Opened from Change it or Before and after ("Fix the cutout"): back to that Change it.
    if let index = app.createPath.lastIndex(of: .changeIt) {
      app.designs.markStale()
      app.createPath = Array(app.createPath.prefix(through: index))
      return
    }
    app.push(next)
  }

  /// "Take a new photo": a new creation of the same product, from the choice of photo.
  private func takeNewPhoto() {
    let type = flow.productType ?? app.flow.productType ?? .sticker
    if isRedo, app.designsPath.last == .yourCutout(artworkId) { app.designsPath.removeLast() }
    app.startNewCreation()
    app.flow.productType = type
    app.createPath = [.chooseMethod]
  }
}
