import Foundation

/// Build-time configuration read from Info.plist (set from build settings in project.yml).
enum AppConfig {
  /// Deployed site (`DEPLOYED_SITE_URL` in project.yml, via Info.plist `DeployedSiteURL`),
  /// used when `API_BASE_URL` is empty or unusable.
  static let deployedSiteURL: URL = {
    guard let raw = Bundle.main.object(forInfoDictionaryKey: "DeployedSiteURL") as? String,
          let url = parse(raw) else {
      preconditionFailure("Info.plist DeployedSiteURL is missing; set DEPLOYED_SITE_URL in project.yml")
    }
    return url
  }()

  /// Site root from the `API_BASE_URL` build setting (Debug: http://localhost:3000,
  /// Release: the deployed site). Override with `xcodebuild ... API_BASE_URL=https://...`.
  static var siteURL: URL {
    siteURL(from: Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String)
  }

  static func siteURL(from raw: String?) -> URL {
    parse(raw) ?? deployedSiteURL
  }

  private static func parse(_ raw: String?) -> URL? {
    let trimmed = (raw ?? "").trimmingCharacters(in: .whitespaces)
    guard let url = URL(string: trimmed), url.scheme?.hasPrefix("http") == true, url.host != nil else { return nil }
    return url
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
