import SwiftUI

/// Board "Change it" (`2012:387`, states `2011:208/246/334`, `2021:2169/2216`): the sticker or tote
/// bag as it is now (round 4 ruling 2: the product photo, `mockupUrl`), what it shows, then the
/// change panel: a "What to change" field, the record button ("Say what to change"; the words land
/// in the field), then "Make the change" and "Looks good as is" side by side at the bottom of the
/// card (stacked at accessibility text sizes; no pinned bar, T122 R4), and the "Fix the cutout" link.
///
/// Making state: when the art on screen has no product for its cut yet (first visit, a saved design,
/// a re-cut whose rebuilt photo is not known), the picture area plays the making animation with
/// "Making your sticker…" while `POST /products` runs (the draft is reused for the same art and type,
/// one `clientRequestId` per attempt, recovered after a lost answer or a return to the app unless the
/// call is still waiting); both buttons wait, with the hint "Your sticker is being made"; then the
/// product photo fades in. "Looks good as is" goes to Listing details on that product (no call);
/// "Make the change" to Changing (change → cutout → products). The original is never overwritten: a
/// change is a new artwork (`POST /artworks/{id}/change`).
struct ChangeItView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @State private var capture: VoiceCapture?
  @State private var instruction = ""
  /// The words last heard, so a spoken change is sent with its transcript.
  @State private var heard: String?
  /// A change was sent from here: coming back (Change it again, Back to my original, Back) starts empty.
  @State private var sent = false
  /// The product call failed (shown with Try again in the picture area).
  @State private var makeError: String?
  @State private var makeAttempt = 0
  @State private var makingRunning = false
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  private var flow: CreateFlow { app.flow }
  private var busy: Bool { capture.map { $0.phase != .idle } ?? false }
  private var trimmed: String { instruction.trimmingCharacters(in: .whitespacesAndNewlines) }
  private var isTote: Bool { flow.productType == .tote }
  /// The product of the cut on screen, ready to show.
  private var product: Product? { flow.readyProduct(for: flow.currentCut) }
  /// The product is being made (or must be): the two buttons wait.
  private var isMaking: Bool { product == nil && makeError == nil }
  /// Re-runs the making state when the art on screen or its cut changes.
  private var productKey: String { "\(flow.currentCut?.id ?? "")|\(flow.currentCut?.cleanedUrl ?? "")|\(makeAttempt)" }

  var body: some View {
    FlowScreen(title: "Change your art?", subtitle: "Say or type what to change. Your original stays safe.", step: (3, 3)) {
      VStack(spacing: Theme.Space.xxl) {
        productArea
          .animation(reduceMotion ? nil : .easeIn(duration: 0.4), value: product?.mockupUrl)
        if let text = flow.currentArt?.shownDescription { DescriptionCard(text: text) }
        changePanel
      }
    }
    .task(id: productKey) {
      guard !makingRunning, product == nil, makeError == nil else { return }
      makingRunning = true
      let flow = app.flow
      // Its own task: leaving the tab does not cancel the call (the server makes the product anyway).
      await Task { @MainActor in await makeProduct(flow) }.value
      makingRunning = false
    }
    .onChange(of: app.flow.resumeCount) { _, _ in
      let flow = app.flow
      Task { @MainActor in
        if await flow.recoverProduct(api: app.api) != nil { makeError = nil }
      }
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
    // Return closes the keyboard (a change is one line), so the buttons and the tab bar come back.
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
        buttons
      }
    }
  }

  /// "Make the change" (primary) and "Looks good as is" (secondary): one row, each half the card,
  /// stacked at accessibility text sizes so the words fit. While the product is made both wait,
  /// with the hint under them (and as their VoiceOver hint). Then the "Fix the cutout" link.
  private var buttons: some View {
    let layout = dynamicTypeSize.isAccessibilitySize
      ? AnyLayout(VStackLayout(spacing: Theme.Space.s))
      : AnyLayout(HStackLayout(alignment: .center, spacing: Theme.Space.s))
    let waitHint: LocalizedStringKey = isTote ? "Your tote bag is being made" : "Your sticker is being made"
    return VStack(spacing: Theme.Space.s) {
      layout {
        PillButton("Make the change", hint: isMaking ? waitHint : "Changes your art the way you asked", showsArrow: false) {
          makeTheChange()
        }
        .disabled(busy || trimmed.isEmpty || product == nil)
        .frame(maxWidth: .infinity)
        PillButton("Looks good as is", hint: isMaking ? waitHint : "Keeps your art as it is and goes on", kind: .secondary, showsArrow: false) {
          capture?.cancel()
          looksGood()
        }
        .disabled(busy || product == nil)
        .frame(maxWidth: .infinity)
      }
      if isMaking {
        Text(waitHint)
          .themeFont(.bodyS)
          .foregroundStyle(colors.textMuted)
          .multilineTextAlignment(.center)
          .frame(maxWidth: .infinity)
          .accessibilityIdentifier("change-making-hint")
      }
      Button { fixTheCutout() } label: {
        Text("Fix the cutout")
          .themeFont(.body)
          .underline()
          .foregroundStyle(colors.text)
          .frame(minWidth: Theme.Size.minTarget, minHeight: Theme.Size.minTarget)
          .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .disabled(isMaking || flow.currentArt.flatMap { flow.cut(for: $0.id) } == nil)
      .opacity(isMaking ? Theme.Opacity.disabled : 1)
      .accessibilityHint(Text("Opens your cutout to add or remove areas"))
    }
    .padding(.top, Theme.Space.xs)
  }

  // MARK: Product (ruling 2)

  /// The product photo once it exists (fading in), else the making animation with its line, or the
  /// product call's error with Try again.
  @ViewBuilder private var productArea: some View {
    if let product {
      ArtPreview(label: isTote ? "Your tote bag" : "Your sticker", art: flow.currentCut,
                 url: ProductPicture.url(type: flow.productType, product: product, artwork: flow.currentCut),
                 photo: nil)
        .transition(.opacity)
        .accessibilityIdentifier("change-product-photo")
    } else if let makeError {
      VStack(spacing: Theme.Space.m) {
        ErrorCard(message: makeError)
        PillButton("Try again", hint: "Repeats the last step", showsArrow: false) {
          self.makeError = nil
          makeAttempt += 1
        }
      }
    } else {
      VStack(spacing: Theme.Space.l) {
        SkyCard(resource: Tokens.Asset.stickerLoading, aspect: ThemeEffects.productLoadingAspect,
                radius: ThemeEffects.artPreviewRadius, reducedMotion: .firstFrame)
          .frame(maxHeight: ThemeEffects.artPreviewHeight)
        Text(isTote ? "Making your tote bag…" : "Making your sticker…")
          .themeFont(.bodyL)
          .foregroundStyle(colors.text)
          .multilineTextAlignment(.center)
        ProgressView().tint(colors.text).accessibilityHidden(true)
        SlowWorkHint()
      }
      .frame(maxWidth: .infinity)
      .accessibilityElement(children: .combine)
      .accessibilityIdentifier("change-making")
    }
  }

  /// `POST /products` for the cut on screen (or the draft reused / read again); written to the flow
  /// the call started with, even if the screen or tab changed.
  private func makeProduct(_ flow: CreateFlow) async {
    guard let art = flow.currentCut, let type = flow.productType else { return }
    guard flow.readyProduct(for: art) == nil else { return }
    UIAccessibility.post(notification: .announcement,
                         argument: type == .tote ? String(localized: "Making your tote bag…") : String(localized: "Making your sticker…"))
    do {
      _ = try await flow.makeProduct(for: art, type: type, api: app.api)
      guard flow === app.flow else { return }
      makeError = nil
      UIAccessibility.post(notification: .announcement,
                           argument: type == .tote ? String(localized: "Your tote bag is ready!") : String(localized: "Your sticker is ready!"))
    } catch {
      if APIError.isCancellation(error) { return }
      if flow === app.flow { makeError = error.localizedDescription }
    }
  }

  /// "Fix the cutout": Your cutout of the art on screen; its "Use this" comes back here.
  private func fixTheCutout() {
    guard app.createPath.last == .changeIt, let art = flow.currentArt, flow.cut(for: art.id) != nil else { return }
    capture?.cancel()
    app.push(.yourCutout(art.id))
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

  /// The listing on the product on screen (`CreateFlow.routeAfterLooksGood`), no call.
  private func looksGood() {
    guard app.createPath.last == .changeIt, let next = flow.routeAfterLooksGood() else { return }
    app.push(next)
  }

  private func makeTheChange() {
    guard !trimmed.isEmpty, flow.currentArt != nil else { return }
    capture?.cancel()
    // No keyboard dismissal here: resigning it in the same update as the push drops the push.
    flow.changeInstruction = trimmed
    // Sent as the transcript only while the words are still the ones heard.
    flow.changeTranscript = heard?.trimmingCharacters(in: .whitespacesAndNewlines) == trimmed ? trimmed : nil
    // A change left half-made for another base or request is not this one.
    if let pending = flow.changeInProgress, pending.base.id != flow.currentArt?.id || pending.instruction != trimmed {
      flow.changeInProgress = nil
    }
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
