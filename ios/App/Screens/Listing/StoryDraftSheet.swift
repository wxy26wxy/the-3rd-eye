import SwiftUI

/// Shown after the story video is saved when the server drafted a story from it.
/// Use saves it as the creator's story; Edit lets them change it first; Skip keeps what they had.
struct StoryDraftSheet: View {
  let draft: StoryDraft
  let onDone: () -> Void
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var text = ""
  @State private var editing = false
  @State private var saving = false
  @State private var error: String?

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: Theme.Space.xl) {
        Text("Here's a story we drafted from your video")
          .themeFont(.titleL)
          .foregroundStyle(colors.text)
          .accessibilityAddTraits(.isHeader)
        Text("It comes from what you said. Use it, change it, or skip it.")
          .themeFont(.body)
          .foregroundStyle(colors.textMuted)

        if editing {
          VoiceTextField(label: "Your story", text: $text, axis: .vertical, appendsVoice: true)
        } else {
          Card {
            VStack(alignment: .leading, spacing: Theme.Space.s) {
              if let headline = draft.headline?.trimmingCharacters(in: .whitespacesAndNewlines), !headline.isEmpty {
                Text(headline).themeFont(.titleM).foregroundStyle(colors.text)
              }
              Text(text).themeFont(.bodyL).foregroundStyle(colors.text)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
          }
          .accessibilityElement(children: .combine)
          .accessibilityLabel(Text("Drafted story: \(spokenText)"))

          Button(app.speech.isSpeaking ? "Stop" : "Read it to me") {
            if app.speech.isSpeaking { app.speech.stop() } else { app.speech.speak(spokenText, force: true) }
          }
          .themeFont(.body)
          .foregroundStyle(colors.text)
          .underline()
          .frame(minHeight: Theme.Size.minTarget)
        }

        if let error { ErrorCard(message: error) }

        VStack(spacing: Theme.Space.l) {
          if editing {
            PillButton(saving ? "Saving…" : "Save my story", hint: "Saves your changes as your story") { Task { await save() } }
              .disabled(saving || trimmed.isEmpty)
          } else {
            PillButton(saving ? "Saving…" : "Use this story", hint: "Saves it as the story buyers read") { Task { await save() } }
              .disabled(saving || trimmed.isEmpty)
            PillButton("Edit it", hint: "Change the words before saving", kind: .secondary, showsArrow: false) {
              app.speech.stop()
              editing = true
            }
            .disabled(saving)
          }
          PillButton("Skip", hint: "Keeps your story as it is", kind: .secondary, showsArrow: false) {
            app.speech.stop()
            onDone()
          }
          .disabled(saving)
        }
      }
      .padding(Theme.Space.page)
    }
    .background(colors.surface.ignoresSafeArea())
    .interactiveDismissDisabled(saving)
    .onAppear {
      if text.isEmpty { text = draft.text }
      app.speech.speak(spokenText)
    }
    .onDisappear { app.speech.stop() }
  }

  private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

  private var spokenText: String {
    [draft.headline, text].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }.joined(separator: ". ")
  }

  private func save() async {
    saving = true
    error = nil
    defer { saving = false }
    do {
      app.speech.stop()
      app.creator = try await app.api.updateMe(UpdateCreatorRequest(storyText: trimmed))
      UIAccessibility.post(notification: .announcement, argument: String(localized: "Story saved"))
      onDone()
    } catch is CancellationError {
      return
    } catch {
      self.error = error.localizedDescription
    }
  }
}
