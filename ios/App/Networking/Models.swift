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

  init() {}

  /// Missing or mistyped keys keep their defaults (older profiles store fewer keys).
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    func flag(_ key: CodingKeys, _ fallback: Bool) -> Bool { ((try? c.decodeIfPresent(Bool.self, forKey: key)) ?? nil) ?? fallback }
    let d = AccessPrefs()
    voiceFirst = flag(.voiceFirst, d.voiceFirst)
    simpleMode = flag(.simpleMode, d.simpleMode)
    speakDescriptions = flag(.speakDescriptions, d.speakDescriptions)
    highContrast = flag(.highContrast, d.highContrast)
    largeText = flag(.largeText, d.largeText)
    helperMode = flag(.helperMode, d.helperMode)
  }
}

struct Split: Codable, Equatable, Hashable {
  var creatorBps: Int
  var orgBps: Int
  var productionBps: Int

  static let `default` = Split(creatorBps: 5000, orgBps: 3000, productionBps: 2000)

  init(creatorBps: Int, orgBps: Int, productionBps: Int) {
    self.creatorBps = creatorBps
    self.orgBps = orgBps
    self.productionBps = productionBps
  }

  /// Missing keys take the default split's value.
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    func bps(_ key: CodingKeys, _ fallback: Int) -> Int { ((try? c.decodeIfPresent(Int.self, forKey: key)) ?? nil) ?? fallback }
    creatorBps = bps(.creatorBps, Self.default.creatorBps)
    orgBps = bps(.orgBps, Self.default.orgBps)
    productionBps = bps(.productionBps, Self.default.productionBps)
  }

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
  /// Story drafted from the story video's transcript (open-weight model), if any.
  var storyDraft: StoryDraft?
}

/// `Creator.storyDraft`. Mirrors `POST /story/draft` (`headline`, `bio_short`,
/// `story_text`); camelCase keys and a bare string are accepted too.
struct StoryDraft: Codable, Equatable {
  var headline: String?
  var bioShort: String?
  var storyText: String?
  var provider: String?

  /// What "Use" saves as `storyText`.
  var text: String { [storyText, bioShort].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }.first { !$0.isEmpty } ?? "" }

  init(headline: String? = nil, bioShort: String? = nil, storyText: String? = nil, provider: String? = nil) {
    self.headline = headline
    self.bioShort = bioShort
    self.storyText = storyText
    self.provider = provider
  }

  private struct Key: CodingKey {
    var stringValue: String
    init(_ s: String) { stringValue = s }
    init?(stringValue: String) { self.stringValue = stringValue }
    var intValue: Int? { nil }
    init?(intValue: Int) { nil }
  }

  init(from decoder: Decoder) throws {
    if let single = try? decoder.singleValueContainer(), let text = try? single.decode(String.self) {
      self.init(storyText: text)
      return
    }
    let c = try decoder.container(keyedBy: Key.self)
    func string(_ names: String...) -> String? {
      for name in names { if let v = try? c.decodeIfPresent(String.self, forKey: Key(name)) { return v } }
      return nil
    }
    self.init(
      headline: string("headline"),
      bioShort: string("bioShort", "bio_short"),
      storyText: string("storyText", "story_text"),
      provider: string("provider"))
  }

  func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: Key.self)
    try c.encodeIfPresent(headline, forKey: Key("headline"))
    try c.encodeIfPresent(bioShort, forKey: Key("bioShort"))
    try c.encodeIfPresent(storyText, forKey: Key("storyText"))
    try c.encodeIfPresent(provider, forKey: Key("provider"))
  }
}

/// `Artwork` (docs/api.md). A changed picture is a child row: `parentArtworkId` and `changeInstruction`.
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
  /// What the creator asked to change (child artworks from `POST /artworks/{id}/change`).
  var changeInstruction: String?
  var status: String?
  var createdAt: String?
  var previewUrl: String?
  /// Set when a pipeline step failed (docs/api.md, T010 clarification 10).
  var lastError: String?
  /// The id the app sent with `change` (round 3, idempotency); null for other rows and older servers.
  var clientRequestId: String?
  /// Only on `GET /artworks` items (`ArtworkListItem`): its products, newest first.
  var products: [ArtworkProduct]?

  /// Best image to show for this artwork.
  var displayURL: URL? {
    [previewUrl, cleanedUrl].compactMap { $0 }.first.flatMap(URL.init(string:))
  }

  /// My designs tile and Design detail (round 3 ruling 1): its sticker's AI product photo
  /// (`mockupUrl`; the bordered preview when there is no mockup), the one in the shop first, else its
  /// tote bag's mockup (the one in the shop first), else the art.
  var creatorPictureURL: URL? {
    let live = (products ?? []).filter { !$0.isArchived }
    func pick(_ type: ProductType, _ url: (ArtworkProduct) -> String?) -> URL? {
      let found = live.filter { $0.type == type && !(url($0) ?? "").isEmpty }
      return ((found.first(where: \.isPublished) ?? found.first).flatMap(url)).flatMap(URL.init(string:))
    }
    let stickerPicture: (ArtworkProduct) -> String? = { [$0.mockupUrl, $0.previewUrl].compactMap { $0 }.first { !$0.isEmpty } }
    return pick(.sticker, stickerPicture) ?? pick(.tote, \.mockupUrl) ?? displayURL
  }

  /// What the picture shows, for the "WHAT THE IMAGE SHOWS" card: the spoken description when
  /// there is one, else the alt text.
  var shownDescription: String? {
    [spokenDescription, altText]
      .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
      .first { !$0.isEmpty }
  }
}

/// `ArtworkProduct` on a `GET /artworks` item: enough for a status badge.
struct ArtworkProduct: Codable, Identifiable, Equatable, Hashable {
  let id: String
  var type: ProductType?
  var status: String?
  /// The listing title, or null before the listing agent ran.
  var title: String?
  /// Live price, listing description and mockup (T087 backend; absent from older servers).
  var priceCents: Int?
  var description: String?
  var mockupUrl: String?
  /// Public bordered PNG of the die-cut sticker (T121; stickers only, absent on older servers).
  var previewUrl: String?

  var isPublished: Bool { status == "published" }
  var isArchived: Bool { status == "archived" }
  var hasListing: Bool { !(title ?? "").trimmingCharacters(in: .whitespaces).isEmpty }
}

struct DeleteArtworkResponse: Decodable {
  let id: String
  var deleted: Bool?
  var archivedProductIds: [String]?
}

struct Candidate: Codable, Identifiable, Equatable, Hashable {
  let id: String
  /// [x0, y0, x1, y1] in pixels of the stored original (see `ImageSize`).
  var bbox: [Double]
  var score: Double?
  var thumbUrl: String?
  /// T155: the piece's own cut (public cleaned PNG), built by the server after detection; nil
  /// until it is ready (and on older servers). A strip tap shows it with no request.
  var cleanedUrl: String?
}

/// Pixel size of the stored original: the coordinate space of `bbox`, cleanup `points` and `box`.
/// Not the size of the photo the app uploaded (the server may upscale it).
struct ImageSize: Codable, Equatable, Hashable {
  let w: Double
  let h: Double

  /// The server can answer 0 × 0 when it could not read the original; such a size is not used.
  var isUsable: Bool { w > 0 && h > 0 }
}

/// A mark on the photo for `POST /artworks/{id}/cleanup`, in `ImageSize` pixels.
struct CutoutPoint: Codable, Equatable, Hashable {
  enum Label: String, Codable { case positive, negative }
  let x: Double
  let y: Double
  let label: Label
}

/// `POST /artworks/{id}/cleanup` body; nil keys are left out (at least one must be set).
struct CleanupRequest: Encodable, Equatable, Hashable {
  var candidateIds: [String]?
  var points: [CutoutPoint]?
  /// [x0, y0, x1, y1] in `ImageSize` pixels.
  var box: [Double]?
  /// T126: the box also limits the cut (nothing outside the frame stays). Needs `box`.
  var clipToBox: Bool?
}

struct Product: Codable, Identifiable, Equatable, Hashable {
  let id: String
  var artworkId: String?
  var creatorId: String?
  var type: ProductType?
  var mockupUrl: String?
  /// Public bordered PNG of the die-cut sticker (T121; stickers only, absent on older servers).
  var previewUrl: String?
  var printPngUrl: String?
  var printSvgUrl: String?
  var priceCents: Int?
  var status: String?
  /// The id the app sent with `POST /products` (round 3, idempotency).
  var clientRequestId: String?
}

/// Which print check flagged a listing (round 3 ruling 2): `resolution` blocks approval, `contrast`
/// is a warning the creator can accept ("Use anyway").
enum PrintCheck: String, Codable, Equatable {
  case resolution, contrast
}

struct ListingDraft: Codable, Equatable {
  var title: String
  var description: String?
  var tags: [String]?
  var priceCents: Int?
  var printOk: Bool?
  /// Null when nothing is flagged (absent on older servers); an unknown value decodes as nil.
  var printCheck: PrintCheck?
  var notes: String?

  init(title: String, description: String? = nil, tags: [String]? = nil, priceCents: Int? = nil,
       printOk: Bool? = nil, printCheck: PrintCheck? = nil, notes: String? = nil) {
    self.title = title
    self.description = description
    self.tags = tags
    self.priceCents = priceCents
    self.printOk = printOk
    self.printCheck = printCheck
    self.notes = notes
  }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    title = try c.decode(String.self, forKey: .title)
    description = try c.decodeIfPresent(String.self, forKey: .description)
    tags = try c.decodeIfPresent([String].self, forKey: .tags)
    priceCents = try c.decodeIfPresent(Int.self, forKey: .priceCents)
    printOk = try c.decodeIfPresent(Bool.self, forKey: .printOk)
    printCheck = (try? c.decodeIfPresent(String.self, forKey: .printCheck)).flatMap { $0 }.flatMap(PrintCheck.init(rawValue:))
    notes = try c.decodeIfPresent(String.self, forKey: .notes)
  }

  enum CodingKeys: String, CodingKey {
    case title, description, tags, notes
    case priceCents = "price_cents"
    case printOk = "print_ok"
    case printCheck = "print_check"
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

struct PhotoArtworkRequest: Encodable {
  /// "photo" | "canvas"
  let source: String
  let imageUrl: String
  let product: ProductType
  /// Round 3: `false` stores the photo without looking for drawings (not used by the app since round 4).
  var detect: Bool?
  /// Round 4 (T143): the picture is the creator's crop; the largest drawing in it is cut out.
  var framed: Bool?
}

struct PhotoArtworkResponse: Decodable { let artwork: Artwork; let candidates: [Candidate]; var imageSize: ImageSize? }
/// `POST /artworks/{id}/cleanup` answer: the `Artwork` plus `details` about products already made
/// from it: `failedProductIds` could not be rebuilt, `unpublishedProductIds` went back to draft
/// (the new cut-out is too small to print).
struct CleanupResult: Decodable, Equatable {
  let artwork: Artwork
  var failedProductIds: [String] = []
  var unpublishedProductIds: [String] = []
  /// Round 4 (T143): the row's live products after the rebuild (new `mockupUrl`), so Change it can
  /// show the rebuilt product photo without a list call. Empty from older servers.
  var products: [ArtworkProduct] = []

  private struct Details: Decodable {
    var failedProductIds: [String]?
    var unpublishedProductIds: [String]?
  }
  private enum Keys: String, CodingKey { case details, products }

  init(artwork: Artwork, failedProductIds: [String] = [], unpublishedProductIds: [String] = [], products: [ArtworkProduct] = []) {
    self.artwork = artwork
    self.failedProductIds = failedProductIds
    self.unpublishedProductIds = unpublishedProductIds
    self.products = products
  }

  init(from decoder: Decoder) throws {
    var art = try Artwork(from: decoder)
    let c = try decoder.container(keyedBy: Keys.self)
    let details = try? c.decodeIfPresent(Details.self, forKey: .details)
    failedProductIds = details?.failedProductIds ?? []
    unpublishedProductIds = details?.unpublishedProductIds ?? []
    products = ((try? c.decodeIfPresent([ArtworkProduct].self, forKey: .products)) ?? nil) ?? []
    // The products are the answer's own field, not the artwork's list summary.
    art.products = nil
    artwork = art
  }
}

/// `GET /artworks/{id}`; `originalUrl` is presigned for 10 minutes (do not store it).
struct ArtworkDetailResponse: Decodable { let artwork: Artwork; let candidates: [Candidate]; var imageSize: ImageSize?; var originalUrl: String? }
struct SelectCandidateRequest: Encodable { let candidateId: String }
/// `POST /artworks/{id}/change`: what to change, typed or spoken (`transcript` is the words heard).
struct ChangeRequest: Encodable {
  let instruction: String
  var transcript: String?
  /// One id per attempt ("Try again" after a lost answer sends it again; the server answers the same row).
  var clientRequestId: String?
}

/// `POST /artworks/{id}/change` answer: the changed picture is a new child artwork
/// (`parentArtworkId` = the one it was made from) with a description of the result.
struct ChangeResponse: Decodable, Equatable {
  let artwork: Artwork
  var description: ChangeDescription?
}

/// Muse Spark's description of a changed picture; `differences` says how it differs from the request.
struct ChangeDescription: Decodable, Equatable, Hashable {
  var alt: String?
  var spoken: String?
  var differences: String?
}

/// `POST /artworks/{id}/cutout` answer: the artwork with its cut-out (the largest piece SAM found
/// on the changed picture), the pieces and the picture's size, for "Your cutout".
struct CutoutResponse: Decodable {
  let artwork: Artwork
  var candidates: [Candidate] = []
  var imageSize: ImageSize?
  /// Round 4 (T143): the row's live products (none for a fresh change result).
  var products: [ArtworkProduct] = []

  private enum Keys: String, CodingKey { case artwork, candidates, imageSize, products }

  init(artwork: Artwork, candidates: [Candidate] = [], imageSize: ImageSize? = nil, products: [ArtworkProduct] = []) {
    self.artwork = artwork
    self.candidates = candidates
    self.imageSize = imageSize
    self.products = products
  }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    artwork = try c.decode(Artwork.self, forKey: .artwork)
    candidates = try c.decodeIfPresent([Candidate].self, forKey: .candidates) ?? []
    imageSize = try c.decodeIfPresent(ImageSize.self, forKey: .imageSize)
    products = ((try? c.decodeIfPresent([ArtworkProduct].self, forKey: .products)) ?? nil) ?? []
  }
}
struct ArtworksResponse: Decodable { let artworks: [Artwork] }

struct CreateProductRequest: Encodable {
  let artworkId: String
  let type: ProductType
  /// One id per attempt, as for `change`.
  var clientRequestId: String?
}

/// `GET /listings/{productId}` (round 3): the product, its saved listing and the last draft the
/// listing agent wrote; both null before the agent first ran.
struct ListingDetailResponse: Decodable {
  let product: Product
  var listing: Listing?
  var draft: ListingDraft?
}

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
  /// Round 3: the creator chose "Use anyway" on a contrast warning (a resolution failure still refuses).
  var acceptPrintWarning: Bool?
}

struct ApproveListingResponse: Decodable {
  let product: Product
  let listing: Listing
  let storyVideoNeeded: Bool
}

struct StoryVideoRequest: Encodable {
  let videoUrl: String
  /// Blob pathname of a 16 kHz mono WAV of the video's soundtrack (used for captions).
  var audioUrl: String?
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
  /// Blob pathname of a WAV of the video's soundtrack (used for captions).
  var audioUrl: String?
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
  struct Body: Decodable {
    let code: String
    let message: String
    /// `print_check_failed` (round 3): which check refused, `resolution` or `contrast`.
    var check: String?
  }
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
