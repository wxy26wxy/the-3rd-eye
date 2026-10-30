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
  /// The server ended the session (token expired); the code screen says so.
  private(set) var sessionExpired = false
  /// A sign-in code that arrived through a link; the code screen takes it once.
  var pendingCode: String?
  var selectedTab: HomeTab = .create {
    didSet { if selectedTab != oldValue { speech.stop() } }
  }
  /// Any route change stops speech before the next screen's onAppear can start
  /// its own (onDisappear of the old screen runs after that, so it can't be used).
  var createPath: [CreateRoute] = [] {
    // NavigationStack writes the same path back after a transition; only a real change stops speech.
    didSet { if createPath != oldValue { speech.stop() } }
  }
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
    api.onUnauthorized = { [weak self] in
      Task { @MainActor in self?.sessionDidExpire() }
    }
  }

  var split: Split { creator?.split ?? .default }
  var themeColors: ThemeColors { prefs.highContrast ? .highContrast : .standard }

  // MARK: Session

  /// Opened from a link such as makerstory://code/ABCD. Ignored while signed in.
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
    selectedTab = .create
  }

  /// Any route answered 401 with our token: sign out and go back to the code screen.
  func sessionDidExpire() {
    guard isSignedIn else { return }
    sessionExpired = true
    signOut()
  }

  func signOut() {
    orders.reset()
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

  /// Saves preferences locally and on the server (best effort).
  func pushPrefs() async {
    guard isSignedIn else { return }
    if let updated = try? await api.updateMe(UpdateCreatorRequest(accessPrefs: prefs)) {
      creator = updated
    }
  }

  // MARK: App lifecycle

  /// Background: stop talking and polling. Foreground: resume polling, drop a stale speaking state.
  func scenePhaseChanged(_ phase: ScenePhase) {
    switch phase {
    case .background:
      speech.stop()
      orders.stop()
    case .active:
      speech.resync()
      if isSignedIn { orders.start() }
    default:
      break
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
  var photoSource: PhotoSource = .camera
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
  /// The picked story video was longer than 30 s and only its start was kept.
  var storyVideoTrimmed = false

  var currentVariant: ArtworkVariant? {
    variants.indices.contains(selectedVariant) ? variants[selectedVariant] : nil
  }
}
