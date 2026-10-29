import AVFoundation
import os
import Observation
import SwiftUI

/// On-device speech for Spark-written descriptions (there is no Meta TTS model).
/// Automatic speech respects the "Speak descriptions" preference; buttons the
/// creator taps (`force: true`) always speak. Create-flow route changes stop it.
///
/// `stopSpeaking(at:)` must never run on the main thread: on iOS 27 it waits
/// synchronously for the TextToSpeech executor and deadlocked the app when a
/// screen change interrupted speech. `stop()` therefore detaches the current
/// synthesizer, stops it on a background queue, and uses a fresh one.
@MainActor
@Observable
final class Speech: NSObject, AVSpeechSynthesizerDelegate {
  private var synthesizer = AVSpeechSynthesizer()
  private static let stopQueue = DispatchQueue(label: "com.makerstory.app.speech-stop")
  private static let log = Logger(subsystem: "com.makerstory.app", category: "speech")
  private(set) var isSpeaking = false
  var speakDescriptions = true
  private var onFinish: (() -> Void)?
  /// The synthesizer activates the session itself; the category is set once.
  private var sessionReady = false

  override init() {
    super.init()
    synthesizer.delegate = self
    // A phone call, Siri or another app taking the audio ends speech without a
    // didFinish/didCancel callback; without this the Stop button stayed up.
    NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
      let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
      guard raw == AVAudioSession.InterruptionType.began.rawValue else { return }
      MainActor.assumeIsolated { self?.stop() }
    }
  }

  /// Clears `isSpeaking` when the synthesizer is no longer talking (after an
  /// interruption or a return from the background).
  func resync() {
    guard isSpeaking, !synthesizer.isSpeaking else { return }
    Self.log.debug("resync: speech had ended")
    isSpeaking = false
    onFinish = nil
  }

  /// Speaks `text`. Calls `then` when finished (or immediately when skipped).
  func speak(_ text: String, force: Bool = false, then: (() -> Void)? = nil) {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, force || speakDescriptions else {
      Self.log.debug("skip speak (empty or prefs off)")
      then?()
      return
    }
    Self.log.debug("speak: \(trimmed.prefix(40), privacy: .public)")
    stop()
    if UIAccessibility.isVoiceOverRunning {
      // Let VoiceOver read it in the creator's chosen voice instead of talking over it.
      UIAccessibility.post(notification: .announcement, argument: trimmed)
      then?()
      return
    }
    if !sessionReady {
      try? AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .spokenAudio, options: [.defaultToSpeaker, .duckOthers])
      sessionReady = true
    }
    let utterance = AVSpeechUtterance(string: trimmed)
    utterance.voice = AVSpeechSynthesisVoice(language: Locale.preferredLanguages.first ?? "en-US")
    utterance.rate = AVSpeechUtteranceDefaultSpeechRate
    onFinish = then
    isSpeaking = true
    synthesizer.speak(utterance)
  }

  func stop() {
    onFinish = nil
    guard isSpeaking else { return }
    Self.log.debug("stop")
    isSpeaking = false
    let old = SynthesizerBox(synthesizer)
    old.value.delegate = nil
    synthesizer = AVSpeechSynthesizer()
    synthesizer.delegate = self
    Self.stopQueue.async { old.value.stopSpeaking(at: .immediate) }
  }

  nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    let id = ObjectIdentifier(synthesizer)
    Task { @MainActor in
      // Ignore late callbacks from a synthesizer that stop() already replaced.
      guard id == ObjectIdentifier(self.synthesizer) else { return }
      self.finished()
    }
  }

  nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    let id = ObjectIdentifier(synthesizer)
    Task { @MainActor in
      guard id == ObjectIdentifier(self.synthesizer) else { return }
      Self.log.debug("cancelled")
      self.isSpeaking = false
    }
  }

  private func finished() {
    Self.log.debug("finished")
    isSpeaking = false
    let done = onFinish
    onFinish = nil
    done?()
  }
}

/// Carries a synthesizer being retired to the background stop queue.
private final class SynthesizerBox: @unchecked Sendable {
  let value: AVSpeechSynthesizer
  init(_ value: AVSpeechSynthesizer) { self.value = value }
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
