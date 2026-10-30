import SwiftUI

/// Board "Voice result": YOU SAID card, variants, WHAT THE IMAGE SHOWS card, Change it / Use this.
struct VoiceResultView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var changing = false
  @State private var instruction = ""
  @State private var capture: VoiceCapture?
  @State private var busy = false
  @State private var error: String?

  var body: some View {
    @Bindable var flow = app.flow
    FlowScreen(title: "Here's your idea", step: (3, 3)) {
      VStack(spacing: Theme.Space.l) {
        Card {
          VStack(alignment: .leading, spacing: Theme.Space.xs) {
            Text("YOU SAID").themeFont(.eyebrow).foregroundStyle(colors.textMuted)
            Text(app.flow.transcript).themeFont(.bodyL).foregroundStyle(colors.text)
          }
        }
        .accessibilityElement(children: .combine)

        if app.flow.variants.count > 1 {
          TabView(selection: $flow.selectedVariant) {
            ForEach(Array(app.flow.variants.enumerated()), id: \.element.id) { index, variant in
              artwork(variant).tag(index)
            }
          }
          .tabViewStyle(.page(indexDisplayMode: .always))
          .indexViewStyle(.page(backgroundDisplayMode: .always))
          .frame(height: ThemeEffects.artworkMaxHeight)
          .accessibilityLabel(Text("Picture \(app.flow.selectedVariant + 1) of \(app.flow.variants.count). Swipe left or right for others."))
        } else if let variant = app.flow.currentVariant {
          artwork(variant).frame(maxHeight: ThemeEffects.artworkMaxHeight)
        }

        if let text = currentDescription { descriptionCard(text) }

        if let diff = app.flow.currentVariant?.differencesFromPrompt, !diff.isEmpty {
          Text("Different from what you said: \(diff)")
            .themeFont(.bodyS)
            .foregroundStyle(colors.textMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
        }

        if changing { changePanel }
        if let error { ErrorCard(message: error) }
      }
    } actions: {
      PillButton("Use this", hint: "Keeps this picture for your product") {
        app.flow.artwork = app.flow.currentVariant
        app.push(.designReady)
      }
      .disabled(busy || app.flow.currentVariant == nil)
      if !changing {
        PillButton("Change it", hint: "Tell me what to change", kind: .secondary, showsArrow: false) {
          changing = true
        }
      }
    }
    .onAppear { if capture == nil { capture = VoiceCapture(api: app.api) } }
    .announces(currentDescription)
    .onDisappear { capture?.cancel() }
  }

  private func artwork(_ variant: ArtworkVariant) -> some View {
    RemoteImage(url: variant.displayURL, altText: variant.altText)
      .padding(Theme.Space.s)
      .background(RoundedRectangle(cornerRadius: Theme.Radius.m).fill(colors.surfaceAlt))
      .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.card))
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(Text(variant.altText ?? String(localized: "Your picture")))
      .accessibilityAddTraits(.isImage)
  }

  /// Visible for creators who can't hear and for everyone else; VoiceOver hears it on arrival.
  private func descriptionCard(_ text: String) -> some View {
    Card {
      VStack(alignment: .leading, spacing: Theme.Space.xs) {
        Text("WHAT THE IMAGE SHOWS").themeFont(.eyebrow).foregroundStyle(colors.textMuted)
        Text(text).themeFont(.bodyL).foregroundStyle(colors.text)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .accessibilityElement(children: .combine)
  }

  private var currentDescription: String? { app.flow.currentVariant.flatMap(Self.description(of:)) }

  /// The spoken description when there is one, else the alt text.
  static func description(of variant: ArtworkVariant) -> String? {
    [variant.spokenDescription, variant.altText]
      .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
      .first { !$0.isEmpty }
  }

  private var changePanel: some View {
    Card {
      VStack(alignment: .leading, spacing: Theme.Space.m) {
        Text("WHAT SHOULD I CHANGE?").themeFont(.eyebrow).foregroundStyle(colors.textMuted)
        LabeledTextField(label: "Change", text: $instruction, prompt: "Make the frog green", axis: .vertical)
        if let capture {
          HStack {
            Spacer()
            RecordButton(phase: capture.phase, idleLabel: "Say what to change") {
              Task {
                if capture.phase == .recording {
                  if let text = await capture.stopAndTranscribe() {
                    instruction = text
                    await refine()
                  }
                } else {
                  await capture.start()
                }
              }
            }
            Spacer()
          }
        }
        PillButton(busy ? "Changing it…" : "Make the change", hint: "Draws a new version with your change") {
          Task { await refine() }
        }
        .disabled(busy || instruction.trimmingCharacters(in: .whitespaces).isEmpty)
        SlowWorkHint(active: busy)
      }
    }
  }

  private func refine() async {
    guard let current = app.flow.currentVariant, !instruction.isEmpty else { return }
    busy = true
    error = nil
    defer { busy = false }
    do {
      let updated = try await app.api.refine(artworkId: current.id, instruction: instruction)
      let index = app.flow.selectedVariant + 1
      app.flow.variants.insert(updated, at: index)
      app.flow.selectedVariant = index
      instruction = ""
      changing = false
    } catch {
      self.error = error.localizedDescription
    }
  }
}
