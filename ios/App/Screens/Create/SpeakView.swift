import SwiftUI

/// Voice branch: describe the idea; Spark shapes it and may ask one question back.
struct SpeakView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var capture: VoiceCapture?
  @State private var typing = false
  @State private var question: String?
  @State private var answerText = ""
  @State private var busy = false
  @State private var error: String?

  var body: some View {
    @Bindable var flow = app.flow
    FlowScreen(
      title: question == nil ? "Say it out loud" : "One quick question",
      subtitle: question == nil ? "Tell me what you want to see. Colors, animals, words, anything." : nil,
      step: (2, 3)
    ) {
      VStack(spacing: Theme.Space.xl) {
        if let question {
          questionCard(question)
        }
        listeningCard
        if typing {
          VStack(alignment: .leading, spacing: Theme.Space.xs) {
            Text(question == nil ? "Type your idea" : "Type your answer").themeFont(.eyebrow).foregroundStyle(colors.textMuted)
            TextField(question == nil ? "A happy frog wearing a crown" : "Your answer", text: question == nil ? $flow.transcript : $answerText, axis: .vertical)
              .themeFont(.bodyL)
              .lineLimit(3...6)
              .padding(Theme.Space.l)
              .frame(minHeight: Theme.Size.cta)
              .background(RoundedRectangle(cornerRadius: Theme.Radius.m).fill(colors.surfaceAlt))
              .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.thin))
              .accessibilityLabel(Text(question == nil ? "Your idea" : "Your answer"))
          }
        }
        if let capture {
          RecordButton(phase: capture.phase, idleLabel: question == nil ? "Start talking" : "Answer out loud", stopLabel: "Stop") {
            Task { await toggleRecording(capture) }
          }
          if let message = capture.error { ErrorCard(message: message) }
        }
        Button(typing ? "Hide the keyboard box" : "Type instead") { typing.toggle() }
          .themeFont(.body)
          .foregroundStyle(colors.text)
          .underline()
          .frame(minHeight: Theme.Size.minTarget)
          .accessibilityHint(Text("Write your idea instead of saying it"))
        if let error { ErrorCard(message: error) { Task { await done() } } }
      }
    } actions: {
      PillButton(busy ? "Thinking…" : "Done", hint: "Turns your words into a picture") {
        Task {
          if question != nil, !answerText.isEmpty {
            app.flow.answers.append(answerText)
            answerText = ""
          }
          await done()
        }
      }
      .disabled(busy || app.flow.transcript.trimmingCharacters(in: .whitespaces).isEmpty || capture?.phase != .idle)
    }
    .onAppear {
      if capture == nil { capture = VoiceCapture(api: app.api) }
      typing = !app.prefs.voiceFirst
    }
    .onDisappear { capture?.cancel() }
  }

  private var listeningCard: some View {
    Card {
      VStack(alignment: .leading, spacing: Theme.Space.s) {
        HStack(spacing: Theme.Space.s) {
          if capture?.phase == .recording {
            Circle().fill(colors.danger).frame(width: Theme.Size.stepDot, height: Theme.Size.stepDot).accessibilityHidden(true)
          }
          Text(capture?.phase == .recording ? "LISTENING" : (app.flow.transcript.isEmpty ? "YOUR IDEA" : "YOU SAID"))
            .themeFont(.eyebrow)
            .foregroundStyle(colors.textMuted)
        }
        Group {
          if capture?.phase == .transcribing {
            Text("Writing down what you said…")
          } else if app.flow.transcript.isEmpty {
            Text("Tap the big button and talk. Your words will show up here.")
          } else {
            Text(app.flow.transcript)
          }
        }
        .themeFont(.bodyL)
        .foregroundStyle(colors.text)
        if !app.flow.answers.isEmpty {
          ForEach(app.flow.answers, id: \.self) { answer in
            Text(answer).themeFont(.bodyS).foregroundStyle(colors.textMuted)
          }
        }
      }
    }
    .accessibilityElement(children: .combine)
  }

  private func questionCard(_ text: String) -> some View {
    Card(selected: true) {
      VStack(alignment: .leading, spacing: Theme.Space.s) {
        Text("QUESTION").themeFont(.eyebrow).foregroundStyle(colors.accentInk)
        Text(text).themeFont(.titleM).foregroundStyle(colors.accentInk)
        Button("Hear it again") { app.speech.speak(text, force: true) }
          .themeFont(.body)
          .foregroundStyle(colors.accentInk)
          .underline()
          .frame(minHeight: Theme.Size.minTarget)
      }
    }
    .accessibilityElement(children: .contain)
  }

  private func toggleRecording(_ capture: VoiceCapture) async {
    switch capture.phase {
    case .idle:
      app.speech.stop()
      await capture.start()
    case .recording:
      guard let text = await capture.stopAndTranscribe() else { return }
      if question != nil {
        app.flow.answers.append(text)
        await done()
      } else {
        app.flow.transcript = app.flow.transcript.isEmpty ? text : app.flow.transcript + " " + text
      }
    case .transcribing:
      break
    }
  }

  private func done() async {
    guard let product = app.flow.productType else { return }
    busy = true
    error = nil
    defer { busy = false }
    do {
      let res = try await app.api.shapePrompt(
        transcript: app.flow.transcript,
        answers: app.flow.answers.isEmpty ? nil : app.flow.answers,
        product: product)
      app.flow.shaped = res
      if let q = res.clarifyingQuestion, !q.isEmpty, app.flow.answers.count < 2 {
        question = q
        app.speech.speak(q, force: true)
        return
      }
      question = nil
      if let confirmation = res.spokenConfirmation { app.speech.speak(confirmation) }
      app.push(.drawingYourIdea)
    } catch {
      self.error = error.localizedDescription
    }
  }
}
