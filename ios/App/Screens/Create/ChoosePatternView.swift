import SwiftUI

/// Board "Choose a pattern" (`2013:408`): the photo on the green card with the picked drawing
/// outlined, the drawings as a strip of thumbnails (one can be picked), then "Use this" (goes on to
/// Adjust the area, where the frame around the drawing is set and the cut is made) and "Retake". A
/// tap on a drawing in the photo picks it too. No drawing found: Adjust the area starts on the whole photo.
///
/// VoiceOver: the strip is the list of drawings ("Piece n", selected trait); the photo is one image.
struct ChoosePatternView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var error: String?
  @State private var originalURL: URL?

  private var flow: CreateFlow { app.flow }
  private var candidates: [Candidate] { flow.photoCandidates }

  var body: some View {
    FlowScreen(title: "Tap the one you want.", subtitle: subtitle, step: (2, 3)) {
      VStack(spacing: Theme.Space.l) {
        if let size = imageSize {
          photoArea(size: size)
        } else if error == nil {
          ProgressView().tint(colors.text).frame(minHeight: Theme.Size.record)
        }
        if !candidates.isEmpty { strip }
        if let error { ErrorCard(message: error) }
      }
    } actions: {
      PillButton("Use this", hint: "Goes on to set the area around your art") { useThis() }
        .disabled(!candidates.isEmpty && flow.pieceCandidateId == nil)
      PillButton("Retake", hint: "Takes a new photo", kind: .secondary, showsArrow: false) {
        let source = flow.photoSource
        flow.discardPhoto()
        app.replaceTop(with: .camera(source))
      }
    }
    .task { await loadDetailIfNeeded() }
  }

  private var subtitle: LocalizedStringKey {
    let tote = flow.productType == .tote
    switch candidates.count {
    case 0: return "We couldn't find a drawing in your photo. Use this to frame it yourself, or take the photo again."
    case 1: return tote ? "We found one drawing in your photo. Use it to change and turn into a tote bag."
                        : "We found one drawing in your photo. Use it to change and turn into a sticker."
    default: return tote ? "We found \(candidates.count) drawings in your photo. Pick one to change and turn into a tote bag."
                         : "We found \(candidates.count) drawings in your photo. Pick one to change and turn into a sticker."
    }
  }

  /// The server's size; falls back to the photo's pixels for an answer without a usable `imageSize`.
  private var imageSize: ImageSize? {
    if let size = flow.photoImageSize, size.isUsable { return size }
    guard let photo = flow.photo else { return nil }
    let size = ImageSize(w: photo.size.width * photo.scale, h: photo.size.height * photo.scale)
    return size.isUsable ? size : nil
  }

  // MARK: Photo

  private func photoArea(size: ImageSize) -> some View {
    // The frame has the picture's own aspect whatever image loads, so taps map to `imageSize` pixels.
    Color.clear
      .aspectRatio(size.w / size.h, contentMode: .fit)
      .overlay { photoImage }
      .frame(maxHeight: Theme.photoMaxHeight - 2 * ThemeEffects.photoCardInset)
      .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.s))
      .softShadow()
      .overlay {
        GeometryReader { geo in
          let frame = CutoutGeometry.fitRect(image: size, in: geo.size)
          ZStack {
            Color.clear
              .contentShape(Rectangle())
              .gesture(SpatialTapGesture().onEnded { value in
                let p = CutoutGeometry.imagePoint(value.location, shownIn: frame, image: size)
                if let hit = Self.candidate(at: p, in: candidates) { pick(hit) }
              })
            ForEach(candidates) { candidate in
              if candidate.id == flow.pieceCandidateId,
                 let rect = CutoutGeometry.viewRect(box: candidate.bbox, shownIn: frame, image: size) {
                outline(rect: rect)
              }
            }
          }
        }
      }
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(Text("Your photo with the drawings we found"))
      .accessibilityAddTraits(.isImage)
      .accessibilityIdentifier("pattern-photo")
      .frame(maxWidth: .infinity)
      .padding(ThemeEffects.photoCardInset)
      .background(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous).fill(colors.accent))
  }

  @ViewBuilder private var photoImage: some View {
    if let photo = flow.photo {
      Image(uiImage: photo).resizable().scaledToFit()
    } else {
      RemoteImage(url: originalURL, altText: String(localized: "Your photo"))
    }
  }

  /// The picked drawing: a 2 pt ink outline with the ink check badge at its top-right corner.
  private func outline(rect: CGRect) -> some View {
    RoundedRectangle(cornerRadius: Theme.Radius.m)
      .stroke(colors.text, lineWidth: ThemeEffects.selectedStroke)
      .frame(width: rect.width, height: rect.height)
      .overlay(alignment: .topTrailing) {
        CheckBadge(size: ThemeEffects.photoCheck)
          .offset(x: ThemeEffects.photoCheck / 2 - Theme.Space.xs, y: -ThemeEffects.photoCheck / 2 + Theme.Space.xs)
      }
      .position(x: rect.midX, y: rect.midY)
      .allowsHitTesting(false)
  }

  /// The smallest drawing whose box holds `point` (image pixels), so a drawing inside another wins.
  static func candidate(at point: CGPoint, in candidates: [Candidate]) -> Candidate? {
    candidates
      .filter { $0.bbox.count == 4 && $0.bbox[0] <= point.x && point.x <= $0.bbox[2] && $0.bbox[1] <= point.y && point.y <= $0.bbox[3] }
      .min { ($0.bbox[2] - $0.bbox[0]) * ($0.bbox[3] - $0.bbox[1]) < ($1.bbox[2] - $1.bbox[0]) * ($1.bbox[3] - $1.bbox[1]) }
  }

  // MARK: Strip

  private var strip: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: Theme.Space.m) {
        ForEach(Array(candidates.enumerated()), id: \.element.id) { index, candidate in
          let on = candidate.id == flow.pieceCandidateId
          Button { pick(candidate) } label: {
            // Figma `Piece chip`: 80 pt white thumbnail; picked = 2 pt ink border and a check
            // badge, not picked = 1 pt border and dimmed art. "Piece n" under it.
            let shape = RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
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
        }
      }
      .padding(.vertical, Theme.Space.xs)
    }
  }

  // MARK: Actions

  private func pick(_ candidate: Candidate) {
    guard flow.pieceCandidateId != candidate.id else { return }
    flow.pieceCandidateId = candidate.id
    error = nil
  }

  /// Without the local photo or a usable size, fetch the artwork (original and drawings).
  private func loadDetailIfNeeded() async {
    guard let artwork = flow.photoArtwork, flow.photo == nil || imageSize == nil else { return }
    do {
      let detail = try await app.api.artworkDetail(id: artwork.id)
      if flow.photoCandidates.isEmpty { flow.photoCandidates = detail.candidates }
      if let size = detail.imageSize, size.isUsable { flow.photoImageSize = size }
      originalURL = detail.originalUrl.flatMap(URL.init(string:))
    } catch {
      if APIError.isCancellation(error) { return }
      self.error = error.localizedDescription
    }
  }

  /// On to Adjust the area with the picked drawing (or, when none was found, the whole photo);
  /// the cut is made there.
  private func useThis() {
    guard flow.photoArtwork != nil, candidates.isEmpty || flow.pieceCandidateId != nil else { return }
    app.push(.adjustArea)
  }
}
