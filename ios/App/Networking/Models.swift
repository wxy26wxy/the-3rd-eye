import Foundation

// Codable mirrors of the types in docs/api.md. Field names match the JSON
// exactly; snake_case fields use explicit CodingKeys. Timestamps stay ISO
// strings so a format change on the server cannot break decoding.

enum ProductType: String, Codable, CaseIterable, Hashable {
  case sticker, tote
}

struct AccessPrefs: Codable, Equatable, Hashable {
  var voiceFirst: Bool = true
  var simpleMode: Bool = true
  var speakDescriptions: Bool = true
  var highContrast: Bool = false
  var largeText: Bool = false
  var helperMode: Bool = false
}

struct Split: Codable, Equatable, Hashable {
  var creatorBps: Int
  var orgBps: Int
  var productionBps: Int

  static let `default` = Split(creatorBps: 5000, orgBps: 3000, productionBps: 2000)

  enum CodingKeys: String, CodingKey {
    case creatorBps = "creator_bps"
    case orgBps = "org_bps"
    case productionBps = "production_bps"
  }
}

struct Creator: Codable, Identifiable, Equatable {
  let id: String
  var slug: String?
  var displayName: String?
  var studioName: String?
  var avatarUrl: String?
  var bioShort: String?
  var storyText: String?
  var storyVideoUrl: String?
  var storyVideoVtt: String?
  var mentionDisability: Bool?
  var accessPrefs: AccessPrefs?
  var split: Split?
  var isExample: Bool?
}

/// `Artwork`; `ArtworkVariant` is the same shape plus `previewUrl`.
struct Artwork: Codable, Identifiable, Equatable, Hashable {
  let id: String
  var creatorId: String?
  var source: String?
  var transcript: String?
  var shapedPrompt: String?
  var originalUrl: String?
  var cleanedUrl: String?
  var maskUrl: String?
  var cutPathSvg: String?
  var altText: String?
  var spokenDescription: String?
  var differencesFromPrompt: String?
  var genResponseId: String?
  var parentArtworkId: String?
  var status: String?
  var createdAt: String?
  var previewUrl: String?

  /// Best image to show for this artwork.
  var displayURL: URL? {
    [previewUrl, cleanedUrl].compactMap { $0 }.first.flatMap(URL.init(string:))
  }
}

typealias ArtworkVariant = Artwork

struct Candidate: Codable, Identifiable, Equatable, Hashable {
  let id: String
  /// [x0, y0, x1, y1] in pixels of the original photo.
  var bbox: [Double]
  var score: Double?
  var thumbUrl: String?
}

struct Product: Codable, Identifiable, Equatable, Hashable {
  let id: String
  var artworkId: String?
  var creatorId: String?
  var type: ProductType?
  var mockupUrl: String?
  var printPngUrl: String?
  var printSvgUrl: String?
  var priceCents: Int?
  var status: String?
}

struct ListingDraft: Codable, Equatable {
  var title: String
  var description: String?
  var tags: [String]?
  var priceCents: Int?
  var printOk: Bool?
  var notes: String?

  enum CodingKeys: String, CodingKey {
    case title, description, tags, notes
    case priceCents = "price_cents"
    case printOk = "print_ok"
  }
}

struct Listing: Codable, Equatable {
  var productId: String
  var title: String?
  var description: String?
  var tags: [String]?
  var priceSuggestionCents: Int?
  var approvedAt: String?
  var approvedVia: String?
  var madeByVoice: Bool?
}

struct AgentStep: Codable, Equatable {
  var step: Int?
  var tool: String?
  var args: JSONValue?
  var result: JSONValue?
  var text: String?
}

struct OrderSummary: Codable, Identifiable, Equatable, Hashable {
  let id: String
  var productId: String?
  var productTitle: String?
  var mockupUrl: String?
  var buyerName: String?
  var amountCents: Int?
  var creatorShareCents: Int?
  var status: String?
  var createdAt: String?
  var hasThankYou: Bool?
  var unreadMessages: Int?
}

/// `Order = OrderSummary & { shipNote, token }`.
struct Order: Codable, Identifiable, Equatable {
  let id: String
  var productId: String?
  var productTitle: String?
  var mockupUrl: String?
  var buyerName: String?
  var amountCents: Int?
  var creatorShareCents: Int?
  var status: String?
  var createdAt: String?
  var hasThankYou: Bool?
  var unreadMessages: Int?
  var shipNote: String?
  var token: String?
}

struct ThankYou: Codable, Identifiable, Equatable {
  let id: String
  var orderId: String?
  var text: String?
  var imageUrl: String?
  var videoUrl: String?
  var createdAt: String?
}

struct Message: Codable, Identifiable, Equatable {
  let id: String
  var orderId: String?
  /// "creator_to_buyer" | "buyer_to_creator"
  var direction: String?
  var body: String
  var createdAt: String?
  var readAt: String?

  var isFromCreator: Bool { direction == "creator_to_buyer" }
}

// MARK: - Request / response envelopes

struct AuthCodeRequest: Encodable { let code: String }
struct AuthCodeResponse: Decodable { let token: String; let creator: Creator }

struct UpdateCreatorRequest: Encodable {
  var displayName: String?
  var studioName: String?
  var bioShort: String?
  var storyText: String?
  var accessPrefs: AccessPrefs?
  var mentionDisability: Bool?
}

struct TranscribeResponse: Decodable {
  let text: String
  var language: String?
}

struct ShapePromptRequest: Encodable {
  let transcript: String
  var answers: [String]?
  let product: ProductType
}

struct ShapePromptResponse: Decodable, Equatable {
  let prompt: String
  var styleNotes: String?
  var clarifyingQuestion: String?
  var spokenConfirmation: String?

  enum CodingKeys: String, CodingKey {
    case prompt
    case styleNotes = "style_notes"
    case clarifyingQuestion = "clarifying_question"
    case spokenConfirmation = "spoken_confirmation"
  }
}

struct TextToImageRequest: Encodable {
  let source = "text2image"
  let prompt: String
  var transcript: String?
  let product: ProductType
  var n: Int?
}

struct PhotoArtworkRequest: Encodable {
  /// "photo" | "canvas"
  let source: String
  let imageUrl: String
  let product: ProductType
}

struct ArtworkVariantsResponse: Decodable { let artworks: [ArtworkVariant] }
struct PhotoArtworkResponse: Decodable { let artwork: Artwork; let candidates: [Candidate] }
struct SelectCandidateRequest: Encodable { let candidateId: String }
struct RefineRequest: Encodable { let instruction: String }
struct RefineResponse: Decodable { let artwork: ArtworkVariant }
struct ArtworksResponse: Decodable { let artworks: [Artwork] }

struct CreateProductRequest: Encodable { let artworkId: String; let type: ProductType }

struct ListingRunResponse: Decodable { let listing: ListingDraft; var trace: [AgentStep]? }

struct ListingEdits: Encodable {
  var title: String?
  var description: String?
  var priceCents: Int?
}

struct ApproveListingRequest: Encodable {
  /// "voice" | "tap"
  let approvedVia: String
  var edits: ListingEdits?
}

struct ApproveListingResponse: Decodable {
  let product: Product
  let listing: Listing
  let storyVideoNeeded: Bool
}

struct StoryVideoRequest: Encodable {
  let videoUrl: String
  var mentionDisability: Bool?
}

struct StoryPromptsResponse: Decodable { let prompts: [String] }

struct OrdersResponse: Decodable {
  let orders: [OrderSummary]
  var unread: Int?
}

struct OrderDetailResponse: Decodable {
  let order: Order
  var thankYou: ThankYou?
  var messages: [Message]?
}

struct ThankYouRequest: Encodable {
  var text: String?
  var imageUrl: String?
  var videoUrl: String?
  var transcript: String?
  var draft: Bool?
}

struct ThankYouDraftResponse: Decodable {
  let draftText: String
  var provider: String?
}

struct MessagesResponse: Decodable { let messages: [Message] }
struct SendMessageRequest: Encodable { let body: String }

struct APIErrorEnvelope: Decodable {
  struct Body: Decodable { let code: String; let message: String }
  let error: Body
}

// MARK: - Free-form JSON (agent trace args/results)

enum JSONValue: Codable, Equatable {
  case string(String), number(Double), bool(Bool), object([String: JSONValue]), array([JSONValue]), null

  init(from decoder: Decoder) throws {
    let c = try decoder.singleValueContainer()
    if c.decodeNil() { self = .null }
    else if let v = try? c.decode(Bool.self) { self = .bool(v) }
    else if let v = try? c.decode(Double.self) { self = .number(v) }
    else if let v = try? c.decode(String.self) { self = .string(v) }
    else if let v = try? c.decode([JSONValue].self) { self = .array(v) }
    else { self = .object(try c.decode([String: JSONValue].self)) }
  }

  func encode(to encoder: Encoder) throws {
    var c = encoder.singleValueContainer()
    switch self {
    case .string(let v): try c.encode(v)
    case .number(let v): try c.encode(v)
    case .bool(let v): try c.encode(v)
    case .object(let v): try c.encode(v)
    case .array(let v): try c.encode(v)
    case .null: try c.encodeNil()
    }
  }
}
