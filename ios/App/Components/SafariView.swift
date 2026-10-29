import SafariServices
import SwiftUI

struct SafariView: UIViewControllerRepresentable {
  let url: URL

  func makeUIViewController(context: Context) -> SFSafariViewController {
    SFSafariViewController(url: url)
  }

  func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

/// Identifiable URL for `.sheet(item:)`.
struct SheetURL: Identifiable {
  let url: URL
  var id: String { url.absoluteString }
}
