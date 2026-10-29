import Foundation
import os

/// Vercel Blob client upload, as implemented by `@vercel/blob/client` 2.8.2
/// (`upload()` → `retrieveClientToken()` → `put`):
/// 1. POST `/api/v1/uploads` `{ type: "blob.generate-client-token", payload: { pathname, callbackUrl, clientPayload, multipart } }`
///    → `{ clientToken }`
/// 2. PUT the bytes to `https://vercel.com/api/blob/?pathname=<pathname>` with
///    `authorization: Bearer <clientToken>`, `x-api-version`, `x-vercel-blob-access`,
///    `x-content-type`, `x-vercel-blob-store-id` → `{ url, downloadUrl, pathname, contentType }`.
struct BlobUploader {
  /// Matches BLOB_API_VERSION in @vercel/blob 2.8.2 (the brief's "7" is older).
  static let apiVersion = "13"
  static let blobAPI = URL(string: "https://vercel.com/api/blob/")!

  enum Kind: String {
    case photo = "photos"
    case storyVideo = "story-video"
    case thankYouImage = "thank-you-images"
    case thankYouVideo = "thank-you-videos"
    case audio = "audio"

    /// Videos are private media (served through /media); images are public.
    var defaultAccess: Access {
      switch self {
      case .storyVideo, .thankYouVideo: return .private
      case .photo, .thankYouImage, .audio: return .public
      }
    }
  }

  enum Access: String { case `public`, `private` }

  private static let log = Logger(subsystem: "com.makerstory.app", category: "upload")

  struct Result: Decodable, Equatable {
    let url: String
    var downloadUrl: String?
    let pathname: String
    var contentType: String?
  }

  private struct TokenEvent: Encodable {
    struct Payload: Encodable {
      let pathname: String
      let callbackUrl: String
      let clientPayload: String?
      let multipart: Bool
    }
    let type = "blob.generate-client-token"
    let payload: Payload
  }

  private struct TokenResponse: Decodable { let clientToken: String }

  let api: APIClient
  var transport: HTTPTransport = URLSession.shared

  /// `creators/<creatorId>/<kind>/<uuid>.<ext>` per docs/api.md.
  static func pathname(creatorId: String, kind: Kind, fileExtension: String) -> String {
    "creators/\(creatorId)/\(kind.rawValue)/\(UUID().uuidString.lowercased()).\(fileExtension)"
  }

  /// Store id is the fourth `_`-separated segment of the token (`vercel_blob_client_<storeId>_...`).
  static func storeId(fromClientToken token: String) -> String {
    let parts = token.split(separator: "_", omittingEmptySubsequences: false)
    return parts.count > 3 ? String(parts[3]) : ""
  }

  /// Uploads with `access` (default: the kind's default). If the store refuses
  /// `private` (private store not linked yet), retries once as `public` and logs it.
  func upload(_ data: Data, creatorId: String, kind: Kind, contentType: String, fileExtension: String, access: Access? = nil) async throws -> Result {
    let pathname = Self.pathname(creatorId: creatorId, kind: kind, fileExtension: fileExtension)
    let event = TokenEvent(payload: .init(
      pathname: pathname,
      callbackUrl: AppConfig.apiURL.appendingPathComponent("uploads").absoluteString,
      clientPayload: "{\"kind\":\"\(kind.rawValue)\"}",
      multipart: false))
    let tokenResponse: TokenResponse = try await api.post("uploads", event)
    let preferred = access ?? kind.defaultAccess
    do {
      return try await put(data, pathname: pathname, token: tokenResponse.clientToken, contentType: contentType, access: preferred)
    } catch APIError.server(let status, _, let message) where preferred == .private && (400..<500).contains(status) {
      Self.log.warning("private upload refused (\(status, privacy: .public)): \(message, privacy: .public); retrying as public")
      return try await put(data, pathname: pathname, token: tokenResponse.clientToken, contentType: contentType, access: .public)
    }
  }

  private func put(_ data: Data, pathname: String, token: String, contentType: String, access: Access) async throws -> Result {
    var components = URLComponents(url: Self.blobAPI, resolvingAgainstBaseURL: false)!
    components.queryItems = [URLQueryItem(name: "pathname", value: pathname)]
    var put = URLRequest(url: components.url!, timeoutInterval: 300)
    put.httpMethod = "PUT"
    put.httpBody = data
    put.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
    put.setValue(Self.apiVersion, forHTTPHeaderField: "x-api-version")
    put.setValue(access.rawValue, forHTTPHeaderField: "x-vercel-blob-access")
    put.setValue(contentType, forHTTPHeaderField: "x-content-type")
    put.setValue(Self.storeId(fromClientToken: token), forHTTPHeaderField: "x-vercel-blob-store-id")
    put.setValue(String(data.count), forHTTPHeaderField: "x-content-length")
    put.setValue(UUID().uuidString, forHTTPHeaderField: "x-api-blob-request-id")

    let (body, response): (Data, URLResponse)
    do {
      (body, response) = try await transport.data(for: put)
    } catch {
      throw APIError.transport(error.localizedDescription)
    }
    guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
    guard (200..<300).contains(http.statusCode) else {
      let message = String(data: body, encoding: .utf8) ?? ""
      throw APIError.server(status: http.statusCode, code: "blob_upload_failed", message: message.isEmpty ? String(localized: "Upload failed. Please try again.") : message)
    }
    do {
      return try JSONDecoder().decode(Result.self, from: body)
    } catch {
      throw APIError.decoding(String(describing: error))
    }
  }
}
