import Observation
import SwiftUI

/// Record → upload to /transcribe → text. Used by the idea path (SpeakView) and "Say what to change" (VoiceResultView).
@MainActor
@Observable
final class VoiceCapture {
  enum Phase: Equatable { case idle, recording, transcribing }

  private(set) var phase: Phase = .idle
  private(set) var error: String?
  let recorder = AudioRecorder()
  private let transcriber: Transcriber

  init(api: APIClient) {
    transcriber = Transcriber(api: api)
  }

  func start() async {
    error = nil
    do {
      try await recorder.start()
      phase = .recording
      UIAccessibility.post(notification: .announcement, argument: String(localized: "Listening"))
    } catch {
      self.error = error.localizedDescription
      phase = .idle
    }
  }

  /// Stops recording and returns the transcript (nil on failure or silence).
  func stopAndTranscribe() async -> String? {
    guard let url = recorder.stop() else { phase = .idle; return nil }
    phase = .transcribing
    defer {
      phase = .idle
      try? FileManager.default.removeItem(at: url)
    }
    do {
      let text = try await transcriber.transcribe(fileURL: url)
      if text.isEmpty { error = String(localized: "I didn't catch that. Try again, or type instead.") }
      return text.isEmpty ? nil : text
    } catch {
      self.error = error.localizedDescription
      return nil
    }
  }

  func cancel() {
    recorder.cancel()
    phase = .idle
  }
}

/// Sky record button (Figma `Record button`): an 84 pt ink circle with the mic; while recording a
/// deep-green circle with an accent ring and a stop square; while transcribing a spinner. The state's
/// word ("Start talking", "Stop", "Working") is shown under it; VoiceOver reads it as the button label.
struct RecordButton: View {
  let phase: VoiceCapture.Phase
  var idleLabel: LocalizedStringKey = "Start talking"
  var stopLabel: LocalizedStringKey = "Stop"
  let action: () -> Void
  @Environment(\.themeColors) private var colors

  private var label: LocalizedStringKey {
    switch phase {
    case .idle: return idleLabel
    case .recording: return stopLabel
    case .transcribing: return "Working"
    }
  }

  var body: some View {
    Button(action: action) {
      VStack(spacing: Theme.Space.s) {
        ZStack {
          Circle().fill(phase == .recording ? colors.accentInk : colors.primary)
          if phase == .recording {
            Circle().strokeBorder(colors.accent, lineWidth: Theme.Border.card * 3)
          }
          switch phase {
          case .idle:
            Image(Tokens.Asset.iconMic)
              .renderingMode(.template)
              .resizable()
              .scaledToFit()
              .frame(width: ThemeEffects.recordGlyph, height: ThemeEffects.recordGlyph)
              .foregroundStyle(colors.primaryText)
          case .recording:
            RoundedRectangle(cornerRadius: Theme.Radius.s / 2)
              .fill(colors.primaryText)
              .frame(width: Theme.Size.record / 5, height: Theme.Size.record / 5)
          case .transcribing:
            ProgressView().tint(colors.primaryText).controlSize(.large)
          }
        }
        .frame(width: Theme.Size.record, height: Theme.Size.record)
        Text(label)
          .themeFont(.titleM)
          .foregroundStyle(colors.text)
          .multilineTextAlignment(.center)
      }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .disabled(phase == .transcribing)
    .accessibilityLabel(Text(phase == .transcribing ? "Writing down what you said" : label))
    .accessibilityHint(Text(phase == .recording ? "Stops recording and writes down what you said" : "Records your voice"))
  }
}
