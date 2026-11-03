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
  /// can be a technical note (print check details, a moderation category). A print check refusal
  /// says what the server measured (round 3 ruling 2): faint colours (a warning: "Use anyway"), or
  /// a picture too small to print sharply.
  static func approveMessage(for error: Error) -> String {
    if let refused = error as? PrintCheckFailed { return refused.creatorMessage }
    if case APIError.server(409, "print_check_failed", _) = error { return PrintCheckFailed(check: nil, message: "").creatorMessage }
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

/// `POST /artworks` (photo) found no drawing; the photo is stored as `artworkId` and can still be cut
/// with a frame over the whole photo.
struct NoDrawingFound: LocalizedError, Equatable {
  let artworkId: String
  let message: String

  var errorDescription: String? { message }
}

/// `{ error: { code, message, artworkId? } }`.
struct NoDrawingEnvelope: Decodable {
  struct Body: Decodable { let code: String; let message: String; var artworkId: String? }
  let error: Body
}

/// `409 print_check_failed` from `POST /listings/{id}/approve` with the check that refused (nil on
/// an older server that does not say).
struct PrintCheckFailed: LocalizedError, Equatable {
  let check: PrintCheck?
  let message: String

  /// Only a contrast warning can be accepted ("Use anyway" → `acceptPrintWarning: true`).
  var canUseAnyway: Bool { check == .contrast }

  var creatorMessage: String {
    switch check {
    case .contrast:
      return String(localized: "Some colors in your art are close together, so it may look faint when printed. You can use it anyway or re-do the cutout.")
    case .resolution:
      return String(localized: "This picture is too small to print sharply. Re-do the cutout with more of the photo, or use a bigger photo.")
    case nil:
      return String(localized: "This picture won't print well yet. Re-do the cutout in My designs, or try a bigger, clearer photo.")
    }
  }

  var errorDescription: String? { creatorMessage }
}
