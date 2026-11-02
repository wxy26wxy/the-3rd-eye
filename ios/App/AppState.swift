import Observation
import SwiftUI

enum HomeTab: Hashable { case create, designs, orders, messages }

/// Pushed screens of the creator flow (root is PickProductView). Photo first (v3 boards):
/// camera → Finding drawings → Choose a pattern → Change it (→ Changing your art → Before and after)
/// → Making your cutout → Your cutout → Making your sticker / tote bag → Listing details.
enum CreateRoute: Hashable {
  case chooseMethod
  case camera(PhotoSource)
  case findingDrawings
  /// Pick one of the drawings SAM found on the photo.
  case choosePattern
  /// Say or type what to change, or keep the art as it is.
  case changeIt
  /// Loading screen while Muse Image changes the art.
  case changing
  /// The change next to the art it was made from.
  case beforeAfter
  /// Loading screen while the changed art is cut out.
  case makingCutout
  /// The cut-out with the edge tools (marks and box).
  case yourCutout
  /// Loading screen while the sticker or tote bag is made.
  case makingProduct
  case listingDetails
  case storyVideo
  case videoSaved
  case youreLive
}

enum PhotoSource: Hashable { case camera, library }

/// Pushed screens of the My designs tab.
enum DesignRoute: Hashable {
  case detail(String)
  /// Your cutout for a saved design (`AppState.designFlow`); "Use this" comes back to the detail.
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
  /// The photo's artwork (`POST /artworks`), its drawings and the stored original's size.
  var photoArtwork: Artwork?
  var photoCandidates: [Candidate] = []
  var photoImageSize: ImageSize?
  /// Choose a pattern: the drawing picked.
  var pieceCandidateId: String?
  /// The picked drawing, cut out (`select`), or the whole photo when none was found, and the
  /// drawing it was cut from.
  var pieceArtwork: Artwork?
  var pieceCutFrom: String?
  /// The latest change (a child artwork); nil while the art is as it was picked.
  var changedArtwork: Artwork?
  /// The art the latest change was made from ("Before").
  var changeBase: Artwork?
  /// What to change, as typed or heard, and the words heard when it was spoken.
  var changeInstruction = ""
  var changeTranscript: String?
  /// How the change differs from the request (`description.differences`).
  var changeDifferences: String?
  /// The artwork "Your cutout" works on, with its pieces, the picture's size, the chosen piece,
  /// marks and box (pixels of that picture).
  var cutoutArtwork: Artwork?
  var candidates: [Candidate] = []
  var imageSize: ImageSize?
  var selectedCandidateIds: [String] = []
  var points: [CutoutPoint] = []
  var box: [Double]?
  /// Shown after a re-cut (My designs) that could not rebuild an existing product.
  var cutoutNotice: String?
  /// The artwork the creator accepted ("Use this" on Your cutout).
  var artwork: Artwork?
  var product: Product?
  /// Listing title of a reused draft product (`continueFrom`), shown in Listing details.
  var productTitle: String?
  /// Listing description of that draft, when the server sent it.
  var productDescription: String?
  var approval: ApproveListingResponse?
  /// The picked story video was longer than 30 s and only its start was kept.
  var storyVideoTrimmed = false

  /// The art the creator sees now: the latest change, else the picked drawing.
  var currentArt: Artwork? { changedArtwork ?? pieceArtwork }

  /// A new photo answer: its drawings; a single one starts picked.
  func setPhoto(artwork: Artwork, candidates: [Candidate], imageSize: ImageSize?) {
    photoArtwork = artwork
    photoCandidates = candidates
    photoImageSize = imageSize
    pieceCandidateId = candidates.count == 1 ? candidates.first?.id : nil
    pieceArtwork = nil
    pieceCutFrom = nil
    resetChange()
  }

  /// Back to the art as it was picked (no change yet).
  func resetChange() {
    changedArtwork = nil
    changeBase = nil
    changeInstruction = ""
    changeTranscript = nil
    changeDifferences = nil
  }

  /// Starts the cut-out state for `artwork` ("Your cutout"): its pieces with `selected` chosen,
  /// no marks, no box.
  func resetCutout(artwork: Artwork?, candidates: [Candidate], imageSize: ImageSize?, selected: [String]? = nil) {
    cutoutArtwork = artwork
    self.candidates = candidates
    self.imageSize = imageSize
    selectedCandidateIds = selected ?? (candidates.count == 1 ? candidates.map(\.id) : [])
    points = []
    box = nil
    cutoutNotice = nil
  }

  /// Retake / Start over: the photo, its drawings, changes and cut-out go, so the next photo starts clean.
  func discardPhoto() {
    photo = nil
    photoArtwork = nil
    photoCandidates = []
    photoImageSize = nil
    pieceCandidateId = nil
    pieceArtwork = nil
    pieceCutFrom = nil
    resetChange()
    resetCutout(artwork: nil, candidates: [], imageSize: nil)
    artwork = nil
    product = nil
  }

}
