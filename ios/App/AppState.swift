import Observation
import SwiftUI

enum HomeTab: Hashable { case create, designs, orders, messages }

/// Pushed screens of the creator flow (root is PickProductView).
enum CreateRoute: Hashable {
  case chooseMethod
  case camera(PhotoSource)
  case findingDrawings
  case tapToSelect
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

/// Session, preferences and navigation shared by every screen.
@MainActor
@Observable
final class AppState {
  let api: APIClient
  let speech = Speech()
  let orders: OrdersStore
  var creator: Creator?
  private(set) var isSignedIn: Bool
  var selectedTab: HomeTab = .create
  var createPath: [CreateRoute] = []
  var flow = CreateFlow()

  var prefs: AccessPrefs {
    didSet {
      speech.speakDescriptions = prefs.speakDescriptions
      Self.savePrefs(prefs)
    }
  }

  init(api: APIClient = APIClient()) {
    self.api = api
    self.isSignedIn = api.isSignedIn
    self.orders = OrdersStore(api: api)
    self.prefs = Self.loadPrefs()
    speech.speakDescriptions = prefs.speakDescriptions
  }

  var split: Split { creator?.split ?? .default }
  var themeColors: ThemeColors { prefs.highContrast ? .highContrast : .standard }

  // MARK: Session

  func signIn(code: String) async throws {
    let creator = try await api.signIn(code: code)
    self.creator = creator
    if let serverPrefs = creator.accessPrefs { prefs = serverPrefs }
    isSignedIn = true
    selectedTab = .create
  }

  func signOut() {
    orders.stop()
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
      signOut()
    } catch {
      // Keep the cached session; screens surface their own errors.
    }
  }

  /// Saves preferences locally and on the server (best effort).
  func pushPrefs() async {
    guard isSignedIn else { return }
    if let updated = try? await api.updateMe(UpdateCreatorRequest(accessPrefs: prefs)) {
      creator = updated
    }
  }

  // MARK: Flow

  func startNewCreation() {
    speech.stop()
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
  var photoArtwork: Artwork?
  var candidates: [Candidate] = []
  var transcript = ""
  var answers: [String] = []
  var shaped: ShapePromptResponse?
  var variants: [ArtworkVariant] = []
  var selectedVariant = 0
  /// The artwork the creator accepted ("Use this").
  var artwork: Artwork?
  var product: Product?
  var approval: ApproveListingResponse?

  var currentVariant: ArtworkVariant? {
    variants.indices.contains(selectedVariant) ? variants[selectedVariant] : nil
  }
}
