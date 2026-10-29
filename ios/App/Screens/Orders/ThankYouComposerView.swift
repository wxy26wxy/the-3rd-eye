import PhotosUI
import SwiftUI

/// Thank-you for a buyer: say it (Muse Voice Transcribe → drafted text), add a photo or a short video.
struct ThankYouComposerView: View {
  let orderId: String
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @Environment(\.dismiss) private var dismiss
  @State private var text = ""
  @State private var transcript: String?
  @State private var capture: VoiceCapture?
  @State private var drafting = false
  @State private var photoItem: PhotosPickerItem?
  @State private var photo: UIImage?
  @State private var imageUrl: String?
  @State private var videoPathname: String?
  @State private var audioPathname: String?
  @State private var videoNote: String?
  @State private var recordingVideo = false
  @State private var uploading = false
  @State private var sending = false
  @State private var error: String?

  var body: some View {
    FlowScreen(title: "Say thank you", subtitle: "The buyer sees this when they tap the story tag.") {
      VStack(alignment: .leading, spacing: Theme.Space.l) {
        if let capture {
          HStack(spacing: Theme.Space.m) {
            RecordButton(phase: capture.phase, idleLabel: "Say your thank-you") {
              Task { await toggle(capture) }
            }
            Text(drafting ? "Writing it down…" : "Say it, and I'll write it down for you.")
              .themeFont(.body)
              .foregroundStyle(colors.text)
          }
          if let message = capture.error { ErrorCard(message: message) }
        }
        VoiceTextField(label: "Your message", text: $text, prompt: "Thank you so much for buying my art!", axis: .vertical)

        if let photo {
          Image(uiImage: photo)
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(maxHeight: ThemeEffects.mockupMaxHeight)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m))
            .accessibilityLabel(Text("Your photo"))
        }
        if videoPathname != nil {
          Label("Video added", systemImage: "checkmark.circle.fill").themeFont(.body).foregroundStyle(colors.text)
          if let videoNote { Text(videoNote).themeFont(.bodyS).foregroundStyle(colors.textMuted) }
        }
        if uploading {
          HStack(spacing: Theme.Space.m) {
            ProgressView().tint(colors.text)
            Text("Uploading…").themeFont(.body).foregroundStyle(colors.text)
          }
          .accessibilityElement(children: .combine)
        }

        HStack(spacing: Theme.Space.m) {
          PhotosPicker(selection: $photoItem, matching: .images) {
            Label("Add a photo", systemImage: "photo")
          }
          .buttonStyle(PillButtonStyle(kind: .secondary, showsArrow: false))
          .accessibilityHint(Text("Adds a picture from your library"))
          Button { recordingVideo = true } label: {
            Label("Add a video", systemImage: "video.fill")
          }
          .buttonStyle(PillButtonStyle(kind: .secondary, showsArrow: false))
          .accessibilityHint(Text("Records up to 15 seconds"))
        }
        if let error { ErrorCard(message: error) }
      }
    } actions: {
      PillButton(sending ? "Sending…" : "Send thank-you", hint: "Sends it to the buyer") {
        Task { await send() }
      }
      .disabled(sending || uploading || (text.isEmpty && imageUrl == nil && videoPathname == nil))
      SlowWorkHint(active: sending || uploading)
    }
    .onAppear { if capture == nil { capture = VoiceCapture(api: app.api) } }
    .onDisappear { capture?.cancel() }
    .stopsSpeechOnDisappear()
    .onChange(of: photoItem) { _, item in
      guard let item else { return }
      Task { await uploadPhoto(item) }
    }
    .fullScreenCover(isPresented: $recordingVideo) {
      MediaPicker(mode: .video(maxSeconds: ThemeEffects.thankYouVideoSeconds)) { picked in
        recordingVideo = false
        if case .video(let url)? = picked { Task { await uploadVideo(url) } }
      }
      .ignoresSafeArea()
    }
  }

  private func creatorId() async throws -> String {
    if app.creator == nil { await app.refreshCreator() }
    guard let id = app.creator?.id else { throw APIError.unauthorized }
    return id
  }

  private func toggle(_ capture: VoiceCapture) async {
    switch capture.phase {
    case .idle:
      await capture.start()
    case .recording:
      guard let spoken = await capture.stopAndTranscribe() else { return }
      transcript = spoken
      drafting = true
      defer { drafting = false }
      do {
        text = try await app.api.draftThankYou(orderId: orderId, transcript: spoken).draftText
        app.speech.speak(text)
      } catch {
        // The drafting model is optional; keep the creator's own words.
        text = spoken
      }
    case .transcribing:
      break
    }
  }

  private func uploadPhoto(_ item: PhotosPickerItem) async {
    uploading = true
    defer { uploading = false }
    do {
      guard let data = try await item.loadTransferable(type: Data.self), let image = UIImage(data: data),
            let jpeg = ImageTools.jpeg(ImageTools.normalized(image)) else { return }
      photo = image
      let uploaded = try await BlobUploader(api: app.api).upload(jpeg, creatorId: try await creatorId(), kind: .thankYouImage, contentType: "image/jpeg", fileExtension: "jpg")
      imageUrl = uploaded.url
    } catch {
      self.error = error.localizedDescription
    }
  }

  private func uploadVideo(_ url: URL) async {
    uploading = true
    defer { uploading = false }
    do {
      let sent = try await VideoUpload(api: app.api).upload(url, creatorId: try await creatorId(), kind: .thankYouVideo, maxSeconds: ThemeEffects.thankYouVideoSeconds)
      videoPathname = sent.videoPathname
      audioPathname = sent.audioPathname
      videoNote = sent.trimmed ? String(localized: "We kept the first 15 seconds of your video.") : nil
    } catch {
      self.error = error.localizedDescription
    }
  }

  private func send() async {
    sending = true
    error = nil
    defer { sending = false }
    do {
      _ = try await app.api.sendThankYou(orderId: orderId, ThankYouRequest(
        text: text.isEmpty ? nil : text, imageUrl: imageUrl, videoUrl: videoPathname, audioUrl: audioPathname, transcript: transcript))
      await app.orders.refresh()
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
