import Foundation

enum APIError: LocalizedError, Equatable {
  /// Server answered with `{ error: { code, message } }` or a bare status.
  case server(status: Int, code: String, message: String)
  case unauthorized
  case decoding(String)
  case transport(String)
  case invalidResponse

  /// URLSession reports a cancelled task as URLError.cancelled, not CancellationError.
  static func isCancellation(_ error: Error) -> Bool {
    error is CancellationError || (error as? URLError)?.code == .cancelled || Task.isCancelled
  }

  var errorDescription: String? {
    switch self {
    case .server(_, _, let message): return message
    case .unauthorized: return String(localized: "Please sign in again with your code.")
    case .decoding: return String(localized: "The app got an answer it did not understand. Please try again.")
    case .transport: return String(localized: "Can't reach maker story. Check your connection and try again.")
    case .invalidResponse: return String(localized: "Something went wrong. Please try again.")
    }
  }
}
