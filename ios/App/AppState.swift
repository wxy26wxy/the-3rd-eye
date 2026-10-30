import Observation
import SwiftUI

enum HomeTab: Hashable { case create, designs, orders, messages }

/// Pushed screens of the creator flow (root is PickProductView).
enum CreateRoute: Hashable {
  case chooseMethod
  case camera(PhotoSource)
  case findingDrawings
  /// Pick one or more candidates and refine the cut-out (also opened from Design ready to redo it).
  case adjustCutout
  case speak
  case drawingYourIdea
  case voiceResult
  case designReady
  case listingDetails
  case storyVideo
  case videoSaved
  case youreLive
}

enum PhotoSource: Hashable { case camera, library }

/// Pushed screens of the My designs tab.
enum DesignRoute: Hashable {
  case detail(String)
  /// Adjust cutout for a saved design (`AppState.designFlow`); "Use this" comes back to the detail.
  case redoCutout
}

/// Session, preferences and navigation shared by every screen.
@MainActor
@Observable
final class AppState {
  let api: APIClient
  let orders: OrdersStore
  let designs: DesignsStore
  var creator: Creator?
  private(set) var isSignedIn: Bool
  /// The server ended the session (token expired); the code screen says so.
  private(set) var sessionExpired = false
  /// A sign-in code that arrived through a link; the code screen takes it once.
  var pendingCode: String?
  var selectedTab: HomeTab = .create
  var createPath: [CreateRoute] = []
  var flow = CreateFlow()
  var designsPath: [DesignRoute] = []
  /// Re-do the cutout from My designs works on its own flow, so a creation in progress in the
  /// Create tab is left alone.
  var designFlow = CreateFlow()

  var prefs: AccessPrefs {
    didSet { Self.savePrefs(prefs) }
  }

  init(api: APIClient = APIClient()) {
    self.api = api
    self.isSignedIn = api.isSignedIn
    self.orders = OrdersStore(api: api)
    self.designs = DesignsStore(api: api)
    self.prefs = Self.loadPrefs()
    api.onUnauthorized = { [weak self] in
      Task { @MainActor in self?.sessionDidExpire() }
    }
  }

  var split: Split { creator?.split ?? .default }

  // MARK: Session

  /// Opened from a link such as the3rdeye://code/ABCD. Ignored while signed in.
  func open(_ url: URL) {
    guard case .code(let code)? = DeepLink.parse(url), !isSignedIn else { return }
    pendingCode = code
  }

  func signIn(code: String) async throws {
    let creator = try await api.signIn(code: code)
    self.creator = creator
    if let serverPrefs = creator.accessPrefs { prefs = serverPrefs }
    isSignedIn = true
    sessionExpired = false
    pendingCode = nil
    selectedTab = .create
  }

  /// Any route answered 401 with our token: sign out and go back to the code screen.
  func sessionDidExpire() {
    guard isSignedIn else { return }
    sessionExpired = true
    signOut()
  }

  func signOut() {
    pendingCode = nil
    orders.reset()
    designs.reset()
    designsPath = []
    designFlow = CreateFlow()
    api.signOut()
    creator = nil
    isSignedIn = false
    createPath = []
    flow = CreateFlow()
  }

  func refreshCreator() async {
    guard isSignedIn else { return }
    do {
      creator = try await api.me()
    } catch APIError.unauthorized {
      sessionDidExpire()
    } catch {
      // Keep the cached session; screens surface their own errors.
    }
  }

  // MARK: App lifecycle

  /// Background: stop polling. Foreground: resume it.
  func scenePhaseChanged(_ phase: ScenePhase) {
    switch phase {
    case .background:
      orders.stop()
    case .active:
      if isSignedIn { orders.start() }
    default:
      break
    }
  }

  // MARK: Flow

  func startNewCreation() {
    flow = CreateFlow()
    createPath = []
    selectedTab = .create
  }

  func push(_ route: CreateRoute) { createPath.append(route) }

  /// Replaces the top screen (used by loading screens so Back skips them).
  func replaceTop(with route: CreateRoute) {
    if !createPath.isEmpty { createPath.removeLast() }
    createPath.append(route)
  }

  func popToRoot() { createPath = [] }

  /// "Make a sticker / Make a tote" on a saved design: a new creation from that artwork, straight
  /// to Listing details. A draft product of that type is reused instead of making another one.
  func continueFrom(artwork: Artwork, productType: ProductType) {
    let next = CreateFlow()
    next.artwork = artwork
    next.productType = productType
    if let draft = artwork.liveProducts.first(where: { $0.type == productType && !$0.isPublished }) {
      next.product = Product(id: draft.id, artworkId: artwork.id, type: productType, mockupUrl: draft.mockupUrl,
                             priceCents: draft.priceCents, status: draft.status)
      next.productTitle = draft.title
      next.productDescription = draft.description
    }
    flow = next
    createPath = [.listingDetails]
    // Coming back to My designs later shows the grid (with fresh badges), not this detail.
    designsPath = []
    selectedTab = .create
  }

  // MARK: Persistence

  private static let prefsKey = "accessPrefs"

  private static func loadPrefs() -> AccessPrefs {
    guard let data = UserDefaults.standard.data(forKey: prefsKey),
          let prefs = try? JSONDecoder().decode(AccessPrefs.self, from: data) else { return AccessPrefs() }
    return prefs
  }

  private static func savePrefs(_ prefs: AccessPrefs) {
    if let data = try? JSONEncoder().encode(prefs) { UserDefaults.standard.set(data, forKey: prefsKey) }
  }
}

/// Work in progress for one creation, from product choice to listing.
@MainActor
@Observable
final class CreateFlow {
  var productType: ProductType?
  var photo: UIImage?
  var photoSource: PhotoSource = .camera
  var photoArtwork: Artwork?
  var candidates: [Candidate] = []
  /// Size of the stored original (`POST /artworks` / `GET /artworks/{id}`); cut-out coordinates use it.
  var imageSize: ImageSize?
  /// Adjust cutout: chosen candidates (in candidate order), marks and box, kept for a redo.
  var selectedCandidateIds: [String] = []
  var points: [CutoutPoint] = []
  var box: [Double]?
  /// Shown on Design ready after a re-cut that could not rebuild an existing product.
  var cutoutNotice: String?
  var transcript = ""
  var answers: [String] = []
  var shaped: ShapePromptResponse?
  var variants: [ArtworkVariant] = []
  var selectedVariant = 0
  /// The artwork the creator accepted ("Use this").
  var artwork: Artwork?
  var product: Product?
  /// Listing title of a reused draft product (`continueFrom`), shown in Listing details.
  var productTitle: String?
  /// Listing description of that draft, when the server sent it.
  var productDescription: String?
  var approval: ApproveListingResponse?
  /// The picked story video was longer than 30 s and only its start was kept.
  var storyVideoTrimmed = false

  /// Starts the cut-out state for a new photo answer.
  func resetCutout(candidates: [Candidate], imageSize: ImageSize?) {
    self.candidates = candidates
    self.imageSize = imageSize
    selectedCandidateIds = candidates.count == 1 ? candidates.map(\.id) : []
    points = []
    box = nil
    cutoutNotice = nil
  }

  var currentVariant: ArtworkVariant? {
    variants.indices.contains(selectedVariant) ? variants[selectedVariant] : nil
  }
}
