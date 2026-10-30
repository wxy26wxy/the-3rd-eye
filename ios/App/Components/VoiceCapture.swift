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

/// 84 pt round record/stop button.
struct RecordButton: View {
  let phase: VoiceCapture.Phase
  var idleLabel: LocalizedStringKey = "Start talking"
  var stopLabel: LocalizedStringKey = "Stop"
  let action: () -> Void
  @Environment(\.themeColors) private var colors
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    Button(action: action) {
      ZStack {
        Circle().fill(phase == .recording ? colors.danger : colors.primary)
        Circle().stroke(colors.border, lineWidth: Theme.Border.card)
        switch phase {
        case .idle:
          Image(systemName: "mic.fill").font(TextRole.displayM.font).foregroundStyle(colors.primaryText)
        case .recording:
          RoundedRectangle(cornerRadius: Theme.Radius.s)
            .fill(colors.primaryText)
            .frame(width: Theme.Size.record / 3, height: Theme.Size.record / 3)
        case .transcribing:
          ProgressView().tint(colors.primaryText).controlSize(.large)
        }
      }
      .frame(width: Theme.Size.record, height: Theme.Size.record)
      .hardShadow(Theme.Shadow.primary, in: Circle())
    }
    .buttonStyle(.plain)
    .disabled(phase == .transcribing)
    .accessibilityLabel(Text(phase == .recording ? stopLabel : (phase == .transcribing ? "Writing down what you said" : idleLabel)))
    .accessibilityHint(Text(phase == .recording ? "Stops recording and writes down what you said" : "Records your voice"))
  }
}
