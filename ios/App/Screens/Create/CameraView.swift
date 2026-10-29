import PhotosUI
import SwiftUI

/// Camera (UIImagePickerController) or library (PhotosPicker) for a drawing.
struct CameraView: View {
  let source: PhotoSource
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var showingCamera = false
  @State private var libraryItem: PhotosPickerItem?
  @State private var error: String?

  var body: some View {
    FlowScreen(
      title: source == .camera ? "Take a photo" : "Upload a picture",
      subtitle: source == .camera ? "Lay your drawing flat in good light. It's fine if there are a few on the page." : "Pick a photo of your drawing.",
      step: (2, 3)
    ) {
      VStack(spacing: Theme.Space.l) {
        TagMascot(pose: .listening)
        if source == .camera && !MediaPicker.cameraAvailable {
          Text("This device has no camera, so you can pick a picture instead.")
            .themeFont(.bodyS)
            .foregroundStyle(colors.textMuted)
        }
        if let error { ErrorCard(message: error) }
      }
    } actions: {
      if source == .camera && MediaPicker.cameraAvailable {
        PillButton("Open the camera", hint: "Takes a photo of your drawing") { showingCamera = true }
      }
      PhotosPicker(selection: $libraryItem, matching: .images) {
        Text("Choose from my photos")
      }
      .buttonStyle(PillButtonStyle(kind: source == .camera && MediaPicker.cameraAvailable ? .secondary : .primary))
      .accessibilityHint(Text("Opens your photo library"))
    }
    .fullScreenCover(isPresented: $showingCamera) {
      MediaPicker(mode: .photo) { picked in
        showingCamera = false
        if case .image(let image)? = picked { use(image) }
      }
      .ignoresSafeArea()
    }
    .onChange(of: libraryItem) { _, item in
      guard let item else { return }
      Task {
        do {
          if let data = try await item.loadTransferable(type: Data.self), let image = UIImage(data: data) {
            use(image)
          } else {
            error = String(localized: "That picture couldn't be opened. Try another one.")
          }
        } catch {
          self.error = String(localized: "That picture couldn't be opened. Try another one.")
        }
      }
    }
    .onAppear {
      if source == .camera && MediaPicker.cameraAvailable && app.prefs.simpleMode && app.flow.photo == nil {
        showingCamera = true
      }
    }
  }

  private func use(_ image: UIImage) {
    app.flow.photo = ImageTools.normalized(image)
    app.flow.photoSource = source
    app.flow.photoArtwork = nil
    app.flow.candidates = []
    app.replaceTop(with: .findingDrawings)
  }
}
