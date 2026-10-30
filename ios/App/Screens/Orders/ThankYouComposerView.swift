import PhotosUI
import SwiftUI

/// Thank-you for a buyer: typed (or the keyboard's dictation), plus a photo or a short video.
struct ThankYouComposerView: View {
  let orderId: String
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @Environment(\.dismiss) private var dismiss
  @State private var text = ""
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
  @State private var cameraDenied = false
  @State private var videoFromLibrary = false

  var body: some View {
    FlowScreen(title: "Say thank you", subtitle: "The buyer sees this when they tap the story tag.") {
      VStack(alignment: .leading, spacing: Theme.Space.l) {
        LabeledTextField(label: "Your message", text: $text, prompt: "Thank you so much for buying my art!", axis: .vertical)

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
          Button { Task { await startRecording() } } label: {
            Label("Add a video", systemImage: "video.fill")
          }
          .buttonStyle(PillButtonStyle(kind: .secondary, showsArrow: false))
          .accessibilityHint(Text("Records up to 15 seconds"))
        }
        if cameraDenied {
          CameraDeniedCard(message: "Camera access is off, so I can't record a video. You can turn it on, or choose a video you already have.", libraryLabel: "Choose a video instead") {
            videoFromLibrary = true
            recordingVideo = true
          }
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
    .onChange(of: photoItem) { _, item in
      guard let item else { return }
      Task { await uploadPhoto(item) }
    }
    .fullScreenCover(isPresented: $recordingVideo) {
      MediaPicker(mode: .video(maxSeconds: ThemeEffects.thankYouVideoSeconds), preferCamera: !videoFromLibrary) { picked in
        recordingVideo = false
        if case .video(let url)? = picked { Task { await uploadVideo(url) } }
      }
      .ignoresSafeArea()
    }
  }

  private func startRecording() async {
    let access = await CameraAccess.request()
    cameraDenied = access == .denied
    guard !cameraDenied else { return }
    videoFromLibrary = false
    recordingVideo = true
  }

  private func creatorId() async throws -> String {
    if app.creator == nil { await app.refreshCreator() }
    guard let id = app.creator?.id else { throw APIError.unauthorized }
    return id
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
        text: text.isEmpty ? nil : text, imageUrl: imageUrl, videoUrl: videoPathname, audioUrl: audioPathname, transcript: nil))
      await app.orders.refresh()
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
