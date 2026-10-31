import AVFoundation
import SwiftUI
import UIKit

/// Camera permission check before opening the camera, so a denial gets guidance
/// instead of a black picker.
enum CameraAccess {
  enum State: Equatable { case allowed, denied, unavailable }

  @MainActor
  static func request() async -> State {
    guard MediaPicker.cameraAvailable else { return .unavailable }
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized:
      return .allowed
    case .notDetermined:
      return await AVCaptureDevice.requestAccess(for: .video) ? .allowed : .denied
    default:
      return .denied
    }
  }

  @MainActor
  static func openSettings() {
    if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
  }
}

/// Shown when camera access is off: what to do, a Settings link, and the library as a way around it.
struct CameraDeniedCard: View {
  let message: LocalizedStringKey
  var libraryLabel: LocalizedStringKey?
  var onLibrary: (() -> Void)?
  @Environment(\.themeColors) private var colors

  var body: some View {
    Card {
      VStack(alignment: .leading, spacing: Theme.Space.m) {
        Label {
          Text(message).themeFont(.body).foregroundStyle(colors.text)
        } icon: {
          Image(systemName: "camera.fill").foregroundStyle(colors.text).accessibilityHidden(true)
        }
        Text("In Settings, tap \(Tokens.Brand.name), then turn on Camera.")
          .themeFont(.bodyS)
          .foregroundStyle(colors.text)
          .padding(Theme.Space.m)
          .frame(maxWidth: .infinity, alignment: .leading)
          .background(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous).fill(colors.surfaceAlt))
        PillButton("Open Settings", hint: "Opens the Settings app so you can turn on the camera", kind: .secondary, showsArrow: false) {
          CameraAccess.openSettings()
        }
        if let libraryLabel, let onLibrary {
          PillButton(libraryLabel, kind: .secondary, showsArrow: false, action: onLibrary)
        }
      }
    }
    .accessibilityElement(children: .contain)
    .onAppear {
      UIAccessibility.post(notification: .announcement, argument: String(localized: "Camera access is off. You can turn it on in Settings."))
    }
  }
}
