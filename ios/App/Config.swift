import Foundation

/// Build-time configuration read from Info.plist (set from build settings in project.yml).
enum AppConfig {
  /// Site root, e.g. http://localhost:3000. Override with `API_BASE_URL=... xcodebuild`.
  static var siteURL: URL {
    let raw = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String ?? ""
    return URL(string: raw.trimmingCharacters(in: .whitespaces)) ?? URL(string: "http://localhost:3000")!
  }

  static var apiURL: URL { siteURL.appendingPathComponent("api/v1") }

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
