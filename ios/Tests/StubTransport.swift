import Foundation
@testable import MakerStory

/// Records requests and answers with a fixed status and body.
final class StubTransport: HTTPTransport, @unchecked Sendable {
  private(set) var requests: [URLRequest] = []
  var status: Int
  var body: String

  init(status: Int = 200, body: String) {
    self.status = status
    self.body = body
  }

  func data(for request: URLRequest) async throws -> (Data, URLResponse) {
    requests.append(request)
    let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
    return (Data(body.utf8), response)
  }
}
