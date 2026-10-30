import SwiftUI

/// First listing only: three talking points, then a ≤ 30 s selfie video.
struct StoryVideoView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var prompts: [String] = StoryVideoView.defaultPrompts
  @State private var mentionDisability = false
  @State private var recording = false
  @State private var uploading = false
  @State private var error: String?
  @State private var cameraDenied = false
  @State private var videoFromLibrary = false
  @State private var draft: StoryDraft?
  /// Set once the server's prompts arrived (or failed), so the talking points are announced once.
  @State private var promptsReady = false

  static let defaultPrompts = [
    String(localized: "Who are you?"),
    String(localized: "What do you love to make?"),
    String(localized: "Why do you make art?"),
  ]

  var body: some View {
    FlowScreen(title: "Tell buyers your story", subtitle: "Record a short video, about 30 seconds. Buyers see it when they tap the story tag. You only do this once.") {
      VStack(alignment: .leading, spacing: Theme.Space.l) {
        ForEach(Array(prompts.enumerated()), id: \.offset) { index, prompt in
          HStack(alignment: .top, spacing: Theme.Space.m) {
            Text("\(index + 1)")
              .themeFont(.titleM)
              .foregroundStyle(colors.primaryText)
              .frame(width: Theme.Size.iconButton, height: Theme.Size.iconButton)
              .background(Circle().fill(colors.primary))
              .accessibilityHidden(true)
            Text(prompt).themeFont(.titleM).foregroundStyle(colors.text)
          }
          .accessibilityElement(children: .combine)
        }
        Toggle(isOn: $mentionDisability) {
          VStack(alignment: .leading, spacing: Theme.Space.xs) {
            Text("Mention my disability").themeFont(.titleM).foregroundStyle(colors.text)
            Text("Off means your story never says it. You can change this later.").themeFont(.bodyS).foregroundStyle(colors.textMuted)
          }
        }
        .tint(colors.primary)
        .frame(minHeight: Theme.Size.cta)

        if uploading {
          HStack(spacing: Theme.Space.m) {
            ProgressView().tint(colors.text)
            Text("Saving your video…").themeFont(.body).foregroundStyle(colors.text)
          }
          .accessibilityElement(children: .combine)
          SlowWorkHint()
        }
        if cameraDenied {
          CameraDeniedCard(message: "Camera access is off, so I can't record your video. You can turn it on, or choose a video you already have.", libraryLabel: "Choose a video instead") {
            videoFromLibrary = true
            recording = true
          }
        }
        if let error { ErrorCard(message: error) }
      }
    } actions: {
      PillButton("Record my video", hint: "Opens the camera for up to 30 seconds") { Task { await startRecording() } }
        .disabled(uploading)
      PillButton("Skip for now", hint: "We'll ask again the next time you list something", kind: .secondary, showsArrow: false) {
        app.push(.youreLive)
      }
      .disabled(uploading)
    }
    .fullScreenCover(isPresented: $recording) {
      MediaPicker(mode: .video(maxSeconds: ThemeEffects.storyVideoSeconds), preferCamera: !videoFromLibrary) { picked in
        recording = false
        if case .video(let url)? = picked { Task { await upload(url) } }
      }
      .ignoresSafeArea()
    }
    .sheet(isPresented: Binding(get: { draft != nil }, set: { if !$0 { draftDone() } })) {
      if let draft { StoryDraftSheet(draft: draft) { draftDone() } }
    }
    .task {
      if let fetched = try? await app.api.storyPrompts(), fetched.count == 3 { prompts = fetched }
      promptsReady = true
    }
    .announces(promptsReady ? prompts.joined(separator: " … ") : nil)
  }

  /// Leaves the draft sheet (Use, Edit + Save, Skip, or swipe down) for "Video saved!".
  private func startRecording() async {
    let access = await CameraAccess.request()
    cameraDenied = access == .denied
    guard !cameraDenied else { return }
    videoFromLibrary = false
    recording = true
  }

  private func draftDone() {
    guard draft != nil else { return }
    draft = nil
    app.push(.videoSaved)
  }

  private func upload(_ url: URL) async {
    uploading = true
    error = nil
    defer { uploading = false }
    do {
      if app.creator == nil { await app.refreshCreator() }
      guard let creatorId = app.creator?.id else { throw APIError.unauthorized }
      let sent = try await VideoUpload(api: app.api).upload(url, creatorId: creatorId, kind: .storyVideo, maxSeconds: ThemeEffects.storyVideoSeconds)
      app.flow.storyVideoTrimmed = sent.trimmed
      var creator = try await app.api.saveStoryVideo(pathname: sent.videoPathname, audioPathname: sent.audioPathname, mentionDisability: mentionDisability)
      // The draft is on GET /creators/me; the story-video answer may not carry it.
      if creator.storyDraft == nil, let fresh = try? await app.api.me() { creator = fresh }
      app.creator = creator
      if let found = creator.storyDraft, !found.text.isEmpty {
        draft = found
      } else {
        app.push(.videoSaved)
      }
    } catch {
      self.error = error.localizedDescription
    }
  }
}
