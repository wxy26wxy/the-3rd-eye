import SwiftUI

/// Board "Change it" (`2012:387`, states `2011:208/246/334`, `2021:2169/2216`): the art as it is now
/// ("YOUR ART"), what it shows, then the change panel: a "What to change" field, the record button
/// ("Say what to change"; the words land in the field) and "Make the change". "Looks good as is"
/// keeps the art: the picked drawing goes straight to Making your sticker with its cut-out, a change
/// is cut out first. The original is never overwritten: a change is a new
/// artwork (`POST /artworks/{id}/change`).
struct ChangeItView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var capture: VoiceCapture?
  @State private var instruction = ""
  /// The words last heard, so a spoken change is sent with its transcript.
  @State private var heard: String?
  /// A change was sent from here: coming back (Change it again, Back to my original, Back) starts empty.
  @State private var sent = false

  private var flow: CreateFlow { app.flow }
  private var busy: Bool { capture.map { $0.phase != .idle } ?? false }
  private var trimmed: String { instruction.trimmingCharacters(in: .whitespacesAndNewlines) }

  var body: some View {
    FlowScreen(title: "Change your art?", subtitle: "Say or type what to change. Your original stays safe.", step: (3, 3)) {
      VStack(spacing: Theme.Space.xxl) {
        ArtPreview(label: "Your art", art: flow.currentArt, photo: flow.photo)
        if let text = flow.currentArt?.shownDescription { DescriptionCard(text: text) }
        changePanel
      }
    } actions: {
      PillButton("Looks good as is", hint: "Keeps your art as it is and goes on") {
        capture?.cancel()
        looksGood()
      }
      .disabled(busy || flow.currentArt == nil)
    }
    .onAppear {
      if capture == nil { capture = VoiceCapture(api: app.api) }
      if sent {
        sent = false
        instruction = ""
        heard = nil
      }
    }
    .onDisappear { capture?.cancel() }
    // Return closes the keyboard (a change is one line), so the pinned bar and the tab bar come back.
    .onChange(of: instruction) { _, text in
      guard text.contains("\n") else { return }
      instruction = text.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespaces)
      Self.hideKeyboard()
    }
  }

  static func hideKeyboard() {
    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
  }

  private var changePanel: some View {
    Card {
      VStack(alignment: .leading, spacing: Theme.Space.m) {
        Text("WHAT SHOULD I CHANGE?").themeFont(.eyebrow).foregroundStyle(colors.textMuted)
        if let status { statusLine(status) }
        LabeledTextField(label: "What to change", text: $instruction, prompt: "Make the book red", axis: .vertical, lines: 3...6)
          .disabled(busy)
        if let capture {
          HStack {
            Spacer()
            RecordButton(phase: capture.phase, idleLabel: "Say what to change") {
              Task { await toggleRecording(capture) }
            }
            Spacer()
          }
          if let message = capture.error { ErrorCard(message: message) }
        }
        PillButton("Make the change", hint: "Changes your art the way you asked") {
          makeTheChange()
        }
        .disabled(busy || trimmed.isEmpty)
      }
    }
  }

  /// "LISTENING" while recording (board `2011:208`), "Writing down what you said…" while the words
  /// are written down (`2021:2169`). The words then land in the field.
  private var status: LocalizedStringKey? {
    switch capture?.phase {
    case .recording: return "LISTENING"
    case .transcribing: return "Writing down what you said…"
    default: return nil
    }
  }

  private func statusLine(_ text: LocalizedStringKey) -> some View {
    HStack(spacing: Theme.Space.s) {
      if capture?.phase == .recording {
        Circle().fill(colors.danger).frame(width: Theme.Size.stepDot, height: Theme.Size.stepDot).accessibilityHidden(true)
      }
      Text(text).themeFont(capture?.phase == .recording ? .eyebrow : .body).foregroundStyle(colors.text)
    }
    .accessibilityElement(children: .combine)
  }

  private func toggleRecording(_ capture: VoiceCapture) async {
    switch capture.phase {
    case .idle:
      await capture.start()
    case .recording:
      guard let text = await capture.stopAndTranscribe() else { return }
      instruction = trimmed.isEmpty ? text : trimmed + " " + text
      heard = instruction
      UIAccessibility.post(notification: .announcement, argument: String(localized: "You said: \(text)"))
    case .transcribing:
      break
    }
  }

  /// The picked drawing already has its cut-out (`select`): straight to Making your sticker. A
  /// change shown here ("Change it again", then kept) is cut out first (`cutout` works on changes only).
  private func looksGood() {
    guard let art = flow.currentArt else { return }
    if flow.changedArtwork == nil, art.cleanedUrl != nil {
      flow.artwork = art
      app.push(.makingProduct)
    } else {
      app.push(.makingCutout)
    }
  }

  private func makeTheChange() {
    guard !trimmed.isEmpty, flow.currentArt != nil else { return }
    capture?.cancel()
    // No keyboard dismissal here: resigning it in the same update as the push drops the push.
    flow.changeInstruction = trimmed
    // Sent as the transcript only while the words are still the ones heard.
    flow.changeTranscript = heard?.trimmingCharacters(in: .whitespacesAndNewlines) == trimmed ? trimmed : nil
    sent = true
    app.push(.changing)
  }
}

/// Figma `Info card` "WHAT THE IMAGE SHOWS": what the picture shows, as text (no in-app speech);
/// one VoiceOver element.
struct DescriptionCard: View {
  let text: String

  var body: some View {
    InfoCard(eyebrow: "WHAT THE IMAGE SHOWS", text: text)
  }
}

/// Figma `Info card`: eyebrow and text on a white card; one VoiceOver element ("You asked, …").
struct InfoCard: View {
  let eyebrow: LocalizedStringKey
  let text: String
  @Environment(\.themeColors) private var colors

  var body: some View {
    Card {
      VStack(alignment: .leading, spacing: Theme.Space.xs) {
        Text(eyebrow).themeFont(.eyebrow).foregroundStyle(colors.textMuted)
        Text(text).themeFont(.bodyL).foregroundStyle(colors.text)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .accessibilityElement(children: .combine)
  }
}
