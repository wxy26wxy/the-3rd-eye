import Foundation

/// Build-time configuration read from Info.plist (set from build settings in project.yml).
enum AppConfig {
  /// Deployed site, used when the build setting is empty or unusable.
  static let deployedSiteURL = URL(string: "https://maker-story-three.vercel.app")!

  /// Site root from the `API_BASE_URL` build setting (Debug: http://localhost:3000,
  /// Release: the deployed site). Override with `xcodebuild ... API_BASE_URL=https://...`.
  static var siteURL: URL {
    siteURL(from: Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String)
  }

  static func siteURL(from raw: String?) -> URL {
    let trimmed = (raw ?? "").trimmingCharacters(in: .whitespaces)
    guard let url = URL(string: trimmed), url.scheme?.hasPrefix("http") == true, url.host != nil else { return deployedSiteURL }
    return url
  }

  static var apiURL: URL { siteURL.appendingPathComponent("api/v1") }

  static let vercelBlobAPI = URL(string: "https://vercel.com/api/blob/")!

  /// Blob store API. Debug builds take `MOCK_BLOB_API` from the launch environment
  /// (UI tests point it at scripts/mock_api.py); Release always uses Vercel.
  static var blobAPIURL: URL {
    #if DEBUG
    if let raw = ProcessInfo.processInfo.environment["MOCK_BLOB_API"], let url = URL(string: raw) { return url }
    #endif
    return vercelBlobAPI
  }

  static var gitSHA: String {
    Bundle.main.object(forInfoDictionaryKey: "GitSHA") as? String ?? "dev"
  }

  static var version: String {
    Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
  }

  /// Public product page shown in "See what buyers see".
  static func productPageURL(productId: String) -> URL {
    siteURL.appendingPathComponent("p").appendingPathComponent(productId)
  }
}
