import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// UIImagePickerController wrapper for camera photos, camera video and the library.
struct MediaPicker: UIViewControllerRepresentable {
  enum Mode { case photo, video(maxSeconds: Double) }
  enum Picked { case image(UIImage), video(URL) }

  let mode: Mode
  var preferCamera = true
  let onPick: (Picked?) -> Void

  static var cameraAvailable: Bool { UIImagePickerController.isSourceTypeAvailable(.camera) }

  func makeUIViewController(context: Context) -> UIImagePickerController {
    let picker = UIImagePickerController()
    picker.delegate = context.coordinator
    picker.sourceType = preferCamera && Self.cameraAvailable ? .camera : .photoLibrary
    switch mode {
    case .photo:
      picker.mediaTypes = [UTType.image.identifier]
    case .video(let maxSeconds):
      picker.mediaTypes = [UTType.movie.identifier]
      picker.videoMaximumDuration = maxSeconds
      picker.videoQuality = .typeMedium
      if picker.sourceType == .camera { picker.cameraCaptureMode = .video; picker.cameraDevice = .front }
    }
    return picker
  }

  func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

  func makeCoordinator() -> Coordinator { Coordinator(onPick: onPick) }

  final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    let onPick: (Picked?) -> Void
    init(onPick: @escaping (Picked?) -> Void) { self.onPick = onPick }

    func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
      if let url = info[.mediaURL] as? URL {
        onPick(.video(url))
      } else if let image = info[.originalImage] as? UIImage {
        onPick(.image(image))
      } else {
        onPick(nil)
      }
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { onPick(nil) }
  }
}
