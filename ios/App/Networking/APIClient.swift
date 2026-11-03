import Foundation

/// Abstracts URLSession so tests can stub responses.
protocol HTTPTransport: Sendable {
  func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: HTTPTransport {}

/// async/await client for `/api/v1` (docs/api.md). Bearer token from Keychain.
final class APIClient: @unchecked Sendable {
  static let tokenAccount = "apiToken"

  let baseURL: URL
  private let transport: HTTPTransport
  private let tokenLock = NSLock()
  private var cachedToken: String?
  private var unauthorizedHandler: (@Sendable () -> Void)?

  /// Called (on any thread) after a signed-in request is answered 401: the token
  /// expired or was revoked. The token is already cleared when it runs.
  var onUnauthorized: (@Sendable () -> Void)? {
    get { tokenLock.lock(); defer { tokenLock.unlock() }; return unauthorizedHandler }
    set { tokenLock.lock(); unauthorizedHandler = newValue; tokenLock.unlock() }
  }

  init(baseURL: URL = AppConfig.apiURL, transport: HTTPTransport = URLSession.shared, token: String? = Keychain.read(account: APIClient.tokenAccount)) {
    self.baseURL = baseURL
    self.transport = transport
    self.cachedToken = token
  }

  var token: String? {
    get { tokenLock.lock(); defer { tokenLock.unlock() }; return cachedToken }
    set {
      tokenLock.lock(); cachedToken = newValue; tokenLock.unlock()
      if let newValue { Keychain.save(newValue, account: Self.tokenAccount) } else { Keychain.delete(account: Self.tokenAccount) }
    }
  }

  var isSignedIn: Bool { token != nil }

  // MARK: Core

  /// Long routes answer within 270 s on the server (docs/api.md, clarification 10);
  /// the client waits longer so it never gives up first and retries work still running.
  static let longTimeout: TimeInterval = 300

  static let decoder = JSONDecoder()
  static let encoder = JSONEncoder()

  func request(_ method: String, _ path: String, query: [URLQueryItem] = [], body: Data? = nil, contentType: String? = "application/json", timeout: TimeInterval = 90) -> URLRequest {
    var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
    if !query.isEmpty { components.queryItems = query }
    var req = URLRequest(url: components.url!, timeoutInterval: timeout)
    req.httpMethod = method
    req.setValue("application/json", forHTTPHeaderField: "Accept")
    if let contentType, body != nil { req.setValue(contentType, forHTTPHeaderField: "Content-Type") }
    if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    req.httpBody = body
    return req
  }

  /// `refine` may turn a failed answer (status, body) into a route-specific error before the generic one.
  func send<Response: Decodable>(_ request: URLRequest, as type: Response.Type = Response.self,
                                 refine: ((Int, Data) -> Error?)? = nil) async throws -> Response {
    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await transport.data(for: request)
    } catch {
      // A cancelled task (screen left, retry) must stay a CancellationError so callers can ignore it.
      if APIError.isCancellation(error) { throw CancellationError() }
      throw APIError.transport(error.localizedDescription)
    }
    guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
    guard (200..<300).contains(http.statusCode) else {
      if http.statusCode == 401 {
        if let sent = request.value(forHTTPHeaderField: "Authorization") {
          expire(sentAuthorization: sent)
          throw APIError.unauthorized
        }
        // Not signed in (e.g. a wrong code on /auth/code): show the server's reason.
        if let envelope = try? Self.decoder.decode(APIErrorEnvelope.self, from: data) {
          throw APIError.server(status: 401, code: envelope.error.code, message: envelope.error.message)
        }
        throw APIError.unauthorized
      }
      if let refined = refine?(http.statusCode, data) { throw refined }
      if let envelope = try? Self.decoder.decode(APIErrorEnvelope.self, from: data) {
        throw APIError.server(status: http.statusCode, code: envelope.error.code, message: envelope.error.message)
      }
      throw APIError.server(status: http.statusCode, code: "http_\(http.statusCode)", message: HTTPURLResponse.localizedString(forStatusCode: http.statusCode))
    }
    do {
      return try Self.decoder.decode(Response.self, from: data)
    } catch {
      throw APIError.decoding(String(describing: error))
    }
  }

  /// Clears the session once, unless a newer sign-in already replaced the token that failed.
  private func expire(sentAuthorization: String) {
    tokenLock.lock()
    let current = cachedToken.map { "Bearer \($0)" }
    let handler = unauthorizedHandler
    tokenLock.unlock()
    guard current == sentAuthorization else { return }
    token = nil
    handler?()
  }

  func get<Response: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> Response {
    try await send(request("GET", path, query: query))
  }

  func post<Body: Encodable, Response: Decodable>(_ path: String, _ body: Body, timeout: TimeInterval = 90) async throws -> Response {
    try await send(request("POST", path, body: try Self.encoder.encode(body), timeout: timeout))
  }

  func put<Body: Encodable, Response: Decodable>(_ path: String, _ body: Body) async throws -> Response {
    try await send(request("PUT", path, body: try Self.encoder.encode(body)))
  }

  private struct Empty: Encodable {}

  /// A long call the creator may leave the app during: iOS is asked for time to finish it
  /// (`BackgroundWork`, round 3 ruling 6).
  private func long<T>(_ name: String, _ operation: () async throws -> T) async throws -> T {
    try await BackgroundWork.run(name, operation)
  }

  // MARK: Auth

  @discardableResult
  func signIn(code: String) async throws -> Creator {
    let res: AuthCodeResponse = try await post("auth/code", AuthCodeRequest(code: code))
    token = res.token
    return res.creator
  }

  func signOut() { token = nil }

  func me() async throws -> Creator { try await get("creators/me") }

  func updateMe(_ update: UpdateCreatorRequest) async throws -> Creator { try await put("creators/me", update) }

  // MARK: Create

  /// Round 3 (docs/api.md "Creator flow (round 3)" step 1): the photo is stored without looking for
  /// drawings (`detect: false`), so Adjust the area opens on the whole photo and `detect` looks inside
  /// the frame. A server that still looks (or `detect: true`) may answer `422 no_drawing_found` with
  /// the stored row's `artworkId`: thrown as `NoDrawingFound`, so the app still opens the photo.
  func artworkFromPhoto(imageUrl: String, product: ProductType, source: String = "photo", detect: Bool? = false) async throws -> PhotoArtworkResponse {
    let body = try Self.encoder.encode(PhotoArtworkRequest(source: source, imageUrl: imageUrl, product: product, detect: detect))
    return try await long("artworks") {
      try await send(request("POST", "artworks", body: body, timeout: Self.longTimeout)) { status, data in
        guard status == 422, let envelope = try? Self.decoder.decode(NoDrawingEnvelope.self, from: data),
              envelope.error.code == "no_drawing_found", let id = envelope.error.artworkId, !id.isEmpty else { return nil }
        return NoDrawingFound(artworkId: id, message: envelope.error.message)
      }
    }
  }

  /// Round 3 step 2: SAM looks for drawings inside the frame (`box`, pixels of `imageSize`) on the
  /// photo row; the largest is cut out with the frame as a clip. Nothing found → `422
  /// no_drawing_found`; a change result → `409 not_a_photo`.
  func detect(artworkId: String, box: [Double]) async throws -> DetectResponse {
    try await long("detect") { try await post("artworks/\(artworkId)/detect", DetectRequest(box: box), timeout: Self.longTimeout) }
  }

  func selectCandidate(artworkId: String, candidateId: String) async throws -> Artwork {
    try await post("artworks/\(artworkId)/select", SelectCandidateRequest(candidateId: candidateId), timeout: Self.longTimeout)
  }

  /// Cut-out from a union of candidates and/or points and a box (docs/api.md, clarification 2).
  /// Allows 300 s: products already made from the artwork are rebuilt in the same request.
  func cleanup(artworkId: String, _ body: CleanupRequest) async throws -> CleanupResult {
    try await long("cleanup") { try await post("artworks/\(artworkId)/cleanup", body, timeout: Self.longTimeout) }
  }

  /// One artwork with its candidates, `imageSize` and a short-lived `originalUrl`.
  func artworkDetail(id: String) async throws -> ArtworkDetailResponse {
    try await get("artworks/\(id)")
  }

  /// "Change it": Muse Image edits the picture with the instruction; the answer is a new child
  /// artwork (the original stays as it was) with a description of the result. `clientRequestId`
  /// (round 3): the same id again answers the row already made, so a retry makes no second change.
  func change(artworkId: String, instruction: String, transcript: String?, clientRequestId: String? = nil) async throws -> ChangeResponse {
    let body = ChangeRequest(instruction: instruction, transcript: transcript, clientRequestId: clientRequestId)
    return try await long("change") { try await post("artworks/\(artworkId)/change", body, timeout: Self.longTimeout) }
  }

  /// Cuts out a changed picture: SAM finds its pieces and the largest one becomes the cut-out.
  func cutout(artworkId: String) async throws -> CutoutResponse {
    let req = request("POST", "artworks/\(artworkId)/cutout", body: try Self.encoder.encode(Empty()), timeout: Self.longTimeout)
    return try await long("cutout") { try await send(req) }
  }

  func myArtworks() async throws -> [Artwork] {
    let res: ArtworksResponse = try await get("artworks")
    return res.artworks
  }

  /// Soft delete: the artwork leaves `GET /artworks`, its products are archived (leave the shop).
  @discardableResult
  func deleteArtwork(id: String) async throws -> DeleteArtworkResponse {
    try await send(request("DELETE", "artworks/\(id)"))
  }

  // MARK: Products and listings

  /// `clientRequestId` (round 3): the same id again answers the product already made.
  func createProduct(artworkId: String, type: ProductType, clientRequestId: String? = nil) async throws -> Product {
    let body = CreateProductRequest(artworkId: artworkId, type: type, clientRequestId: clientRequestId)
    return try await long("products") { try await post("products", body, timeout: Self.longTimeout) }
  }

  func runListingAgent(productId: String) async throws -> ListingRunResponse {
    let req = request("POST", "listings/\(productId)/run", body: try Self.encoder.encode(Empty()), timeout: Self.longTimeout)
    return try await long("listing-run") { try await send(req) }
  }

  /// Round 3: the product with its saved listing and the agent's last draft (recovery).
  func listing(productId: String) async throws -> ListingDetailResponse {
    try await get("listings/\(productId)")
  }

  /// A refused print check is thrown as `PrintCheckFailed` (round 3 ruling 2: which check refused).
  /// `acceptPrintWarning`: the creator chose "Use anyway" on a contrast warning.
  func approveListing(productId: String, via: String, edits: ListingEdits?, acceptPrintWarning: Bool = false) async throws -> ApproveListingResponse {
    let body = try Self.encoder.encode(ApproveListingRequest(approvedVia: via, edits: edits, acceptPrintWarning: acceptPrintWarning ? true : nil))
    let req = request("POST", "listings/\(productId)/approve", body: body, timeout: Self.longTimeout)
    return try await long("approve") {
      try await send(req) { status, data in
        guard status == 409, let envelope = try? Self.decoder.decode(APIErrorEnvelope.self, from: data),
              envelope.error.code == "print_check_failed" else { return nil }
        return PrintCheckFailed(check: envelope.error.check.flatMap(PrintCheck.init(rawValue:)), message: envelope.error.message)
      }
    }
  }

  // MARK: Story

  func storyPrompts() async throws -> [String] {
    let res: StoryPromptsResponse = try await get("creators/me/story-prompts")
    return res.prompts
  }

  func saveStoryVideo(pathname: String, audioPathname: String?, mentionDisability: Bool) async throws -> Creator {
    let body = StoryVideoRequest(videoUrl: pathname, audioUrl: audioPathname, mentionDisability: mentionDisability)
    return try await long("story-video") { try await post("creators/me/story-video", body, timeout: Self.longTimeout) }
  }

  // MARK: Orders and messages

  func orders(since: String?) async throws -> OrdersResponse {
    try await get("orders", query: since.map { [URLQueryItem(name: "since", value: $0)] } ?? [])
  }

  func order(id: String) async throws -> OrderDetailResponse { try await get("orders/\(id)") }

  func draftThankYou(orderId: String, transcript: String) async throws -> ThankYouDraftResponse {
    try await post("orders/\(orderId)/thank-you", ThankYouRequest(transcript: transcript, draft: true))
  }

  func sendThankYou(orderId: String, _ body: ThankYouRequest) async throws -> ThankYou {
    // Captions are made while the request is open when a video is attached.
    try await post("orders/\(orderId)/thank-you", body, timeout: body.videoUrl == nil ? 90 : Self.longTimeout)
  }

  func messages(orderId: String) async throws -> [Message] {
    let res: MessagesResponse = try await get("orders/\(orderId)/messages")
    return res.messages
  }

  func sendMessage(orderId: String, body: String) async throws -> Message {
    try await post("orders/\(orderId)/messages", SendMessageRequest(body: body))
  }
}
