import Foundation

/// Links the app understands. `the3rdeye://code/<CODE>` pre-fills the sign-in code
/// (the studio shares it from /admin); the person still taps Sign in.
enum DeepLink: Equatable {
  case code(String)

  static let scheme = Tokens.Brand.scheme

  static func parse(_ url: URL) -> DeepLink? {
    guard url.scheme?.lowercased() == scheme, url.host?.lowercased() == "code" else { return nil }
    let raw = url.pathComponents.filter { $0 != "/" }.first ?? ""
    let cleaned = raw.uppercased().filter { $0.isLetter || $0.isNumber || $0 == "-" }
    guard !cleaned.isEmpty, cleaned.count <= 64 else { return nil }
    return .code(cleaned)
  }
}
