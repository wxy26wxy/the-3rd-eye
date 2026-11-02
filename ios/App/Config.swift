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

  /// Site root from the `API_BASE_URL` build setting (Debug and Release: `$(DEPLOYED_SITE_URL)`,
  /// the deployed site). Override with `xcodebuild ... API_BASE_URL=http://localhost:3000` (or any https URL).
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

  /// A private blob pathname served through the site's `/media/{pathname}` (docs/api.md; a
  /// creator's current story video needs no sign-in there). A full URL is used as it is.
  static func mediaURL(pathname: String) -> URL? {
    let trimmed = pathname.trimmingCharacters(in: .whitespaces)
    guard !trimmed.isEmpty else { return nil }
    if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") { return URL(string: trimmed) }
    return trimmed.split(separator: "/").reduce(siteURL.appendingPathComponent("media")) { $0.appendingPathComponent(String($1)) }
  }

  /// Public product page shown in "See what buyers see".
  static func productPageURL(productId: String) -> URL {
    siteURL.appendingPathComponent("p").appendingPathComponent(productId)
  }
}
