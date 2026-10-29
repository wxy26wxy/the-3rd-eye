import SwiftUI

/// First listing only: three talking points read aloud, then a ≤ 30 s selfie video.
struct StoryVideoView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var prompts: [String] = StoryVideoView.defaultPrompts
  @State private var mentionDisability = false
  @State private var recording = false
  @State private var uploading = false
  @State private var error: String?

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
        Button("Hear the questions") { speakPrompts(force: true) }
          .themeFont(.body)
          .foregroundStyle(colors.text)
          .underline()
          .frame(minHeight: Theme.Size.minTarget)

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
        }
        if let error { ErrorCard(message: error) }
      }
    } actions: {
      PillButton("Record my video", hint: "Opens the camera for up to 30 seconds") { recording = true }
        .disabled(uploading)
      PillButton("Skip for now", hint: "You can record it later in Settings", kind: .secondary, showsArrow: false) {
        app.push(.youreLive)
      }
      .disabled(uploading)
    }
    .fullScreenCover(isPresented: $recording) {
      MediaPicker(mode: .video(maxSeconds: ThemeEffects.storyVideoSeconds)) { picked in
        recording = false
        if case .video(let url)? = picked { Task { await upload(url) } }
      }
      .ignoresSafeArea()
    }
    .task {
      if let fetched = try? await app.api.storyPrompts(), fetched.count == 3 { prompts = fetched }
      speakPrompts(force: false)
    }
  }

  private func speakPrompts(force: Bool) {
    app.speech.speak(prompts.joined(separator: " … "), force: force)
  }

  private func upload(_ url: URL) async {
    uploading = true
    error = nil
    defer { uploading = false }
    do {
      if app.creator == nil { await app.refreshCreator() }
      guard let creatorId = app.creator?.id else { throw APIError.unauthorized }
      let data = try Data(contentsOf: url)
      let ext = url.pathExtension.lowercased() == "mp4" ? "mp4" : "mov"
      let uploaded = try await BlobUploader(api: app.api).upload(
        data, creatorId: creatorId, kind: .storyVideo,
        contentType: ext == "mp4" ? "video/mp4" : "video/quicktime", fileExtension: ext)
      app.creator = try await app.api.saveStoryVideo(pathname: uploaded.pathname, mentionDisability: mentionDisability)
      app.push(.videoSaved)
    } catch {
      self.error = error.localizedDescription
    }
  }
}
