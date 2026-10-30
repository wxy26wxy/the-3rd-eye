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

  /// `POST /listings/{id}/approve` refusals in the creator's words: the server's message for these
  /// can be a technical note (print check details, a moderation category).
  static func approveMessage(for error: Error) -> String {
    if case APIError.server(409, "print_check_failed", _) = error {
      return String(localized: "This picture won't print well yet. Re-do the cutout in My designs, or try a bigger, clearer photo.")
    }
    if case APIError.server(409, "moderation_failed", _) = error {
      return String(localized: "Some words in the name or description can't go in the shop. Change them and try again.")
    }
    return error.localizedDescription
  }

  var errorDescription: String? {
    switch self {
    case .server(_, _, let message): return message
    case .unauthorized: return String(localized: "Please sign in again with your code.")
    case .decoding: return String(localized: "The app got an answer it did not understand. Please try again.")
    case .transport: return String(localized: "Can't reach \(Tokens.Brand.name). Check your connection and try again.")
    case .invalidResponse: return String(localized: "Something went wrong. Please try again.")
    }
  }
}
