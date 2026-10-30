import Foundation
@testable import The3rdEye

/// Records requests and answers with a fixed status and body.
final class StubTransport: HTTPTransport, @unchecked Sendable {
  private(set) var requests: [URLRequest] = []
  var status: Int
  var body: String
  /// Answers used in order before falling back to `status`/`body`.
  var queue: [(Int, String)] = []

  init(status: Int = 200, body: String) {
    self.status = status
    self.body = body
  }

  func data(for request: URLRequest) async throws -> (Data, URLResponse) {
    requests.append(request)
    let (status, body) = queue.isEmpty ? (status, body) : queue.removeFirst()
    let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
    return (Data(body.utf8), response)
  }
}
