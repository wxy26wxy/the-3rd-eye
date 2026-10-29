import AVFoundation
import Observation
import SwiftUI

/// On-device speech for Spark-written descriptions (there is no Meta TTS model).
/// Automatic speech respects the "Speak descriptions" preference; buttons the
/// creator taps (`force: true`) always speak. Screens stop it on disappear.
@MainActor
@Observable
final class Speech: NSObject, AVSpeechSynthesizerDelegate {
  private let synthesizer = AVSpeechSynthesizer()
  private(set) var isSpeaking = false
  var speakDescriptions = true
  private var onFinish: (() -> Void)?

  override init() {
    super.init()
    synthesizer.delegate = self
  }

  /// Speaks `text`. Calls `then` when finished (or immediately when skipped).
  func speak(_ text: String, force: Bool = false, then: (() -> Void)? = nil) {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, force || speakDescriptions else { then?(); return }
    stop()
    if UIAccessibility.isVoiceOverRunning {
      // Let VoiceOver read it in the creator's chosen voice instead of talking over it.
      UIAccessibility.post(notification: .announcement, argument: trimmed)
      then?()
      return
    }
    try? AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .spokenAudio, options: [.defaultToSpeaker, .duckOthers])
    try? AVAudioSession.sharedInstance().setActive(true)
    let utterance = AVSpeechUtterance(string: trimmed)
    utterance.voice = AVSpeechSynthesisVoice(language: Locale.preferredLanguages.first ?? "en-US")
    utterance.rate = AVSpeechUtteranceDefaultSpeechRate
    onFinish = then
    isSpeaking = true
    synthesizer.speak(utterance)
  }

  func stop() {
    onFinish = nil
    if synthesizer.isSpeaking { synthesizer.stopSpeaking(at: .immediate) }
    isSpeaking = false
  }

  nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    Task { @MainActor in self.finished() }
  }

  nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    Task { @MainActor in self.isSpeaking = false }
  }

  private func finished() {
    isSpeaking = false
    let done = onFinish
    onFinish = nil
    done?()
  }
}

private struct StopsSpeech: ViewModifier {
  @Environment(AppState.self) private var app
  func body(content: Content) -> some View {
    content.onDisappear { app.speech.stop() }
  }
}

extension View {
  /// Stops any speech when the screen goes away.
  func stopsSpeechOnDisappear() -> some View { modifier(StopsSpeech()) }
}
