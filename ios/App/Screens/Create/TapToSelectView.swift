import SwiftUI

/// Board "Tap to select": SAM candidates drawn over the photo; tap one.
struct TapToSelectView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var chosen: Candidate?
  @State private var busy = false
  @State private var error: String?

  var body: some View {
    FlowScreen(
      title: "Tap your drawing",
      subtitle: app.flow.candidates.isEmpty ? "We couldn't find a drawing. Try another photo." : "We found \(app.flow.candidates.count) drawings. Tap the one to use.",
      step: (2, 3)
    ) {
      VStack(spacing: Theme.Space.l) {
        if let photo = app.flow.photo {
          photoWithCandidates(photo)
        }
        if !app.flow.candidates.isEmpty {
          candidateList
        }
        if let error { ErrorCard(message: error) }
      }
    } actions: {
      PillButton(busy ? "Cutting it out…" : "Use this", hint: "Cuts out the drawing you picked") {
        Task { await useChosen() }
      }
      .disabled(chosen == nil || busy)
      PillButton("Retake", hint: "Takes a new photo", kind: .secondary, showsArrow: false) {
        app.replaceTop(with: .camera(app.flow.photoSource))
      }
    }
    .onAppear { if chosen == nil, app.flow.candidates.count == 1 { chosen = app.flow.candidates.first } }
  }

  private func photoWithCandidates(_ photo: UIImage) -> some View {
    Image(uiImage: photo)
      .resizable()
      .aspectRatio(contentMode: .fit)
      .overlay {
        GeometryReader { geo in
          let scale = geo.size.width / max(photo.size.width, 1)
          ForEach(Array(app.flow.candidates.enumerated()), id: \.element.id) { index, candidate in
            let rect = frame(for: candidate, scale: scale)
            Button { choose(candidate) } label: {
              RoundedRectangle(cornerRadius: Theme.Radius.s)
                .fill(chosen == candidate ? colors.selected.opacity(ThemeEffects.selectionFillOpacity) : Color.clear)
                .overlay(
                  RoundedRectangle(cornerRadius: Theme.Radius.s)
                    .stroke(chosen == candidate ? colors.selected : colors.surface, style: StrokeStyle(lineWidth: Theme.Border.card, dash: chosen == candidate ? [] : [Theme.Space.s, Theme.Space.xs]))
                )
                .overlay(alignment: .topLeading) {
                  Text("\(index + 1)")
                    .themeFont(.caption)
                    .foregroundStyle(colors.primaryText)
                    .padding(Theme.Space.xs)
                    .background(Circle().fill(colors.primary))
                }
            }
            .buttonStyle(.plain)
            .frame(width: max(rect.width, Theme.Size.minTarget), height: max(rect.height, Theme.Size.minTarget))
            .position(x: rect.midX, y: rect.midY)
            .accessibilityLabel(Text("Drawing \(index + 1)"))
            .accessibilityAddTraits(chosen == candidate ? .isSelected : [])
          }
        }
      }
      .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m))
      .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.card))
      .accessibilityElement(children: .contain)
      .accessibilityLabel(Text("Your photo"))
  }

  /// Thumbnails as a second, list-shaped way to choose (easier with VoiceOver and Switch Control).
  private var candidateList: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: Theme.Space.m) {
        ForEach(Array(app.flow.candidates.enumerated()), id: \.element.id) { index, candidate in
          Button { choose(candidate) } label: {
            VStack(spacing: Theme.Space.xs) {
              RemoteImage(url: candidate.thumbUrl.flatMap(URL.init(string:)), altText: nil)
                .frame(width: Theme.Size.record, height: Theme.Size.record)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.s))
              Text("Drawing \(index + 1)").themeFont(.caption).foregroundStyle(colors.text)
            }
            .padding(Theme.Space.xs)
            .background(RoundedRectangle(cornerRadius: Theme.Radius.m).fill(chosen == candidate ? colors.selected : colors.surfaceAlt))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.thin))
          }
          .buttonStyle(.plain)
          .accessibilityLabel(Text("Drawing \(index + 1)"))
          .accessibilityHint(Text("Selects this drawing"))
          .accessibilityAddTraits(chosen == candidate ? .isSelected : [])
        }
      }
      .padding(.vertical, Theme.Space.xs)
    }
  }

  private func frame(for candidate: Candidate, scale: CGFloat) -> CGRect {
    guard candidate.bbox.count == 4 else { return .zero }
    let b = candidate.bbox.map { CGFloat($0) * scale }
    return CGRect(x: b[0], y: b[1], width: b[2] - b[0], height: b[3] - b[1])
  }

  private func choose(_ candidate: Candidate) {
    chosen = candidate
    UIAccessibility.post(notification: .announcement, argument: String(localized: "Selected"))
  }

  private func useChosen() async {
    guard let chosen, let artwork = app.flow.photoArtwork else { return }
    busy = true
    error = nil
    defer { busy = false }
    do {
      app.flow.artwork = try await app.api.selectCandidate(artworkId: artwork.id, candidateId: chosen.id)
      app.push(.designReady)
    } catch {
      self.error = error.localizedDescription
    }
  }
}
