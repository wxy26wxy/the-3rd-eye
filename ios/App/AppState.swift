import Observation
import SwiftUI

enum HomeTab: Hashable { case create, designs, orders, messages }

/// Pushed screens of the creator flow (root is PickProductView). Photo first, round 3 order (T136):
/// camera → Finding ("Getting your photo ready…", the upload) → Adjust the area (the whole photo) →
/// Making your cutout (`detect` inside the frame) → Your cutout → Change it → [Changing your art →
/// Before and after → Making your cutout → Your cutout] → Making your sticker / tote bag → Listing
/// details. "My story video" (T122) also opens from the root.
enum CreateRoute: Hashable {
  case chooseMethod
  case camera(PhotoSource)
  /// Uploads the photo (`POST /artworks {detect: false}`); no drawing is looked for yet.
  case findingDrawings
  /// The frame on the photo (the whole photo at first); "Use this area" goes on to Making your cutout.
  case adjustArea
  /// Say or type what to change, or keep the art as it is.
  case changeIt
  /// Loading screen while Muse Image changes the art.
  case changing
  /// The change next to the art it was made from.
  case beforeAfter
  /// Loading screen while the art is cut out: the frame on the photo (`detect`), or a kept change (`cutout`).
  case makingCutout(CutJob)
  /// The cut-out of the artwork with this id (the photo's piece, or a change), with the edge tools.
  case yourCutout(String)
  /// Loading screen while the sticker or tote bag is made.
  case makingProduct
  case listingDetails
  case storyVideo
  case videoSaved
  case youreLive
  /// "My story video" from the Create tab: watch it, record it again.
  case storyLibrary
  /// Story video recorded again from "My story video"; comes back there.
  case recordStoryAgain
}

/// What Making your cutout cuts.
enum CutJob: Hashable {
  /// Adjust the area's frame on the photo (round 3): `detect {box}` finds the drawings inside it and
  /// cuts out the largest, clipped to the frame.
  case detect([Double])
  /// A kept change (`cutout`, once per artwork; later visits use `CreateFlow.changeCuts`).
  case change(String)
}

enum PhotoSource: Hashable { case camera, library }

/// Pushed screens of the My designs tab.
enum DesignRoute: Hashable {
  case detail(String)
  /// Adjust the area for a saved design (`AppState.designFlow`); "Use this area" comes back to the detail.
  case adjustArea
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
      // Round 3 ruling 6: a long call in flight may have finished (or been dropped) while the app
      // was away; its screen reconciles from the server before any retry.
      flow.appBecameActive()
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
                             previewUrl: draft.previewUrl, priceCents: draft.priceCents, status: draft.status)
      next.productTitle = draft.title
      next.productDescription = draft.description
    }
    flow = next
    createPath = [.listingDetails]
    // Coming back to My designs later shows the grid (with fresh badges), not this detail.
    designsPath = []
    selectedTab = .create
  }

  /// Listing details › "Redo" (round 3 ruling 5): back to Your cutout of the product's art, the
  /// draft product kept (Use this again reuses it). From a saved design (no Your cutout in the
  /// path) Your cutout opens on the design's cut-out.
  func backToCutout() {
    guard let art = flow.artwork else { return }
    if let index = createPath.lastIndex(of: .yourCutout(art.id)) {
      createPath = Array(createPath.prefix(through: index))
      return
    }
    if flow.cut(for: art.id) == nil {
      flow.changeCuts[art.id] = Cut(artwork: art, candidates: [], imageSize: nil, selected: [], box: nil)
    }
    createPath = [.yourCutout(art.id)]
  }

  /// "Re-do the cutout" after a resolution refusal (review I1, web parity): back to Adjust the area
  /// so the frame can take more of the photo. In a creation that is the Adjust the area in the path;
  /// for a draft opened from My designs, Adjust the area on that design (`GET /artworks/{id}`) in
  /// the My designs tab, which comes back to the design.
  func backToArea() async throws {
    if let index = createPath.lastIndex(of: .adjustArea) {
      createPath = Array(createPath.prefix(through: index))
      return
    }
    guard let art = flow.artwork else { return }
    let detail = try await api.artworkDetail(id: art.id)
    let redo = CreateFlow()
    redo.artwork = detail.artwork
    redo.resetCutout(artwork: detail.artwork, candidates: detail.candidates, imageSize: detail.imageSize)
    redo.productType = flow.productType
    designFlow = redo
    // One screen at a time, after the tab shows: a stack given two screens at once while its tab
    // is hidden draws an empty page.
    selectedTab = .designs
    designsPath = [.detail(art.id)]
    try? await Task.sleep(for: .milliseconds(400))
    if designsPath == [.detail(art.id)] { designsPath.append(.adjustArea) }
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
  /// The drawing cut out of the photo (`detect`, or a pick / marks on Your cutout) and the drawing
  /// it was cut from.
  var pieceArtwork: Artwork?
  var pieceCutFrom: String?
  /// The frame (Adjust the area) `pieceArtwork` was cut with.
  var pieceBox: [Double]?
  /// `detect` found nothing in the frame: Adjust the area shows this when it comes back on screen.
  var areaError: String?
  /// The long call in flight (round 3 ruling 6) and how often the app came back while it ran.
  private(set) var pendingJob: PendingJob?
  private(set) var resumeCount = 0
  /// Long calls still waiting for their answer (re-review N1): no recovery runs while one is.
  private(set) var callsInFlight = 0
  /// Every change made in this creation, oldest first (T131: "Back to my original" steps back one
  /// change and keeps the chain).
  var changes: [ChangeStep] = []
  /// The change on screen; nil while the art is the picked piece.
  var changedArtworkId: String?
  /// What to change next, as typed or heard, and the words heard when it was spoken.
  var changeInstruction = ""
  var changeTranscript: String?
  /// Cut-outs of changes (`cutout`), per artwork id, so a change kept again is not cut twice.
  var changeCuts: [String: Cut] = [:]
  /// The artwork "Your cutout" shows (or a saved design's Adjust the area cuts), with its pieces,
  /// the picture's size and the chosen piece.
  var cutoutArtwork: Artwork?
  var candidates: [Candidate] = []
  var imageSize: ImageSize?
  var selectedCandidateIds: [String] = []
  /// Shown after a re-cut (My designs) that could not rebuild an existing product.
  var cutoutNotice: String?
  /// The artwork the creator accepted ("Use this" on Your cutout).
  var artwork: Artwork?
  var product: Product?
  /// The cut-out (`cleanedUrl`) `product` was made from, so a re-cut is noticed before it is reused.
  var productCut: String?
  /// Listing title of a reused draft product (`continueFrom`), shown in Listing details.
  var productTitle: String?
  /// Listing description of that draft, when the server sent it.
  var productDescription: String?
  var approval: ApproveListingResponse?
  /// The picked story video was longer than 30 s and only its start was kept.
  var storyVideoTrimmed = false

  /// The art the creator sees now: the change on screen, else the picked drawing.
  var currentArt: Artwork? { changedArtwork ?? pieceArtwork }

  private var currentStep: ChangeStep? { changes.first { $0.artwork.id == changedArtworkId } }

  /// The change on screen ("After").
  var changedArtwork: Artwork? { currentStep?.artwork }
  /// The art the change on screen was made from ("Before").
  var changeBase: Artwork? { currentStep?.base }
  /// What was asked for the change on screen ("YOU ASKED").
  var changeAsked: String? { currentStep?.instruction }
  /// How the change on screen differs from the request (`description.differences`).
  var changeDifferences: String? { currentStep?.differences }

  /// A change answer: kept in the chain and put on screen.
  func addChange(_ step: ChangeStep) {
    changes.removeAll { $0.artwork.id == step.artwork.id }
    changes.append(step)
    changedArtworkId = step.artwork.id
  }

  /// "Back to my original": one change back, to the art the change on screen was made from (the
  /// previous change, or the picked piece). The chain stays; no call.
  func stepBack() {
    guard let step = currentStep else { return }
    changedArtworkId = changes.contains { $0.artwork.id == step.base.id } ? step.base.id : nil
  }

  /// A newer version of an artwork in the chain (its cut-out): every step that shows it follows.
  func updateChange(_ artwork: Artwork) {
    for index in changes.indices {
      if changes[index].artwork.id == artwork.id { changes[index].artwork = artwork }
      if changes[index].base.id == artwork.id { changes[index].base = artwork }
    }
  }

  // MARK: Cut-outs (Your cutout)

  /// The cut Your cutout shows for `artworkId`: the photo's piece (cut on Adjust the area, the frame
  /// is its box), or a change's cut-out (the whole picture is its box).
  func cut(for artworkId: String) -> Cut? {
    if artworkId == photoArtwork?.id {
      guard let piece = pieceArtwork, piece.cleanedUrl != nil else { return nil }
      return Cut(artwork: piece, candidates: photoCandidates, imageSize: photoPixelSize,
                 selected: pieceCutFrom.map { [$0] } ?? [], box: pieceBox)
    }
    return changeCuts[artworkId]
  }

  /// The photo's size in pixels of the stored original; the local photo's pixels when the server sent none.
  var photoPixelSize: ImageSize? {
    if let size = photoImageSize, size.isUsable { return size }
    guard let photo else { return nil }
    let size = ImageSize(w: photo.size.width * photo.scale, h: photo.size.height * photo.scale)
    return size.isUsable ? size : nil
  }

  /// A new cut of `artworkId` (Making your cutout, or Apply cutout): the flow follows it.
  func recordCut(of artworkId: String, _ cut: Artwork, request: CleanupRequest? = nil) {
    if artworkId == photoArtwork?.id {
      if let request {
        pieceCutFrom = request.candidateIds?.first
        if let box = request.box { pieceBox = box }
      }
      pieceArtwork = cut
      updateChange(cut)
    } else {
      changeCuts[artworkId]?.artwork = cut
      if let ids = request?.candidateIds, !ids.isEmpty { changeCuts[artworkId]?.selected = ids }
      updateChange(cut)
    }
  }

  /// A `detect` answer for the frame `box`: the drawings found inside it, the largest cut out. A new
  /// piece drops the changes made from the old one.
  func recordDetect(_ res: DetectResponse, box: [Double]) {
    guard let photo = photoArtwork else { return }
    var cut = res.artwork
    if cut.altText?.isEmpty ?? true { cut.altText = photo.altText }
    photoCandidates = res.candidates
    if let size = res.imageSize, size.isUsable { photoImageSize = size }
    resetChange()
    pieceCutFrom = res.candidates.first?.id
    pieceBox = box
    pieceArtwork = cut
  }

  // MARK: Route table (T131)

  /// Adjust the area › "Use this area" (round 3): the frame already cut goes straight to Your cutout;
  /// otherwise Making your cutout sends `detect` with the frame (the first time, and again for every
  /// new frame; marks on Your cutout keep `cleanup`).
  func routeAfterArea(box: [Double]) -> CreateRoute? {
    guard let photoId = photoArtwork?.id else { return nil }
    if let piece = pieceArtwork, piece.cleanedUrl != nil, pieceBox == box { return .yourCutout(photoId) }
    return .makingCutout(.detect(box))
  }

  /// Your cutout › "Use this": the piece goes on to Change it; a change's cut-out is the product's art.
  func routeAfterCutout(of artworkId: String) -> CreateRoute? {
    guard let cut = cut(for: artworkId) else { return nil }
    if artworkId == photoArtwork?.id { return .changeIt }
    artwork = cut.artwork
    return .makingProduct
  }

  /// Change it › "Looks good as is": the piece's cut-out (reviewed on Your cutout) makes the product;
  /// a change shown there (Change it again, or one change back) is cut out first unless it already was.
  func routeAfterLooksGood() -> CreateRoute? {
    guard let art = currentArt else { return nil }
    if changedArtwork == nil {
      guard art.cleanedUrl != nil else { return nil }
      artwork = art
      return .makingProduct
    }
    if let cut = changeCuts[art.id] {
      artwork = cut.artwork
      return .makingProduct
    }
    return .makingCutout(.change(art.id))
  }

  /// Before and after › "Use this": the change's cut-out (made once per artwork), then Your cutout.
  func routeAfterKeepingChange() -> CreateRoute? {
    guard let change = changedArtwork else { return nil }
    return changeCuts[change.id] != nil ? .yourCutout(change.id) : .makingCutout(.change(change.id))
  }

  /// A new photo answer (stored, no drawings looked for yet in round 3).
  func setPhoto(artwork: Artwork, candidates: [Candidate], imageSize: ImageSize?) {
    photoArtwork = artwork
    photoCandidates = candidates
    photoImageSize = imageSize
    areaError = nil
    pieceArtwork = nil
    pieceCutFrom = nil
    pieceBox = nil
    resetChange()
  }

  /// No changes: the art is the picked piece again, and the changes' cut-outs go.
  func resetChange() {
    pendingJob = nil
    changes = []
    changedArtworkId = nil
    changeCuts = [:]
    changeInstruction = ""
    changeTranscript = nil
  }

  /// Starts the cut-out state for `artwork` (Your cutout, or Adjust the area on a saved design): its
  /// pieces with `selected` chosen.
  func resetCutout(artwork: Artwork?, candidates: [Candidate], imageSize: ImageSize?, selected: [String]? = nil) {
    cutoutArtwork = artwork
    self.candidates = candidates
    self.imageSize = imageSize
    selectedCandidateIds = selected ?? (candidates.count == 1 ? candidates.map(\.id) : [])
    cutoutNotice = nil
  }

  /// Retake / Start over: the photo, its drawings, changes and cut-out go, so the next photo starts clean.
  func discardPhoto() {
    photo = nil
    photoArtwork = nil
    photoCandidates = []
    photoImageSize = nil
    areaError = nil
    pendingJob = nil
    pieceArtwork = nil
    pieceCutFrom = nil
    pieceBox = nil
    resetChange()
    resetCutout(artwork: nil, candidates: [], imageSize: nil)
    artwork = nil
    product = nil
    productCut = nil
  }

  // MARK: Product for this cut-out

  /// What Making your sticker does: make the product, reuse the draft it already made for this
  /// artwork (Back from Listing details, then Use this again), or reuse it after a re-cut, when the
  /// server has rebuilt its print file and mockup and the client must read them again.
  enum ProductPlan: Equatable {
    case create
    case reuse(Product)
    case refresh(Product)
  }

  func productPlan(for artwork: Artwork, type: ProductType) -> ProductPlan {
    guard let product, product.artworkId == artwork.id, product.type == type else { return .create }
    return productCut == artwork.cleanedUrl ? .reuse(product) : .refresh(product)
  }

  /// Records the product made (or refreshed) from `artwork`'s current cut-out.
  func useProduct(_ product: Product, madeFrom artwork: Artwork) {
    self.product = product
    productCut = artwork.cleanedUrl
  }

  /// Products already known for `artwork` when a product job starts (never that job's answer).
  func knownProductIds(of artwork: Artwork) -> Set<String> {
    var ids = Set((artwork.products ?? []).map(\.id))
    if let product { ids.insert(product.id) }
    return ids
  }

  /// The draft with the mockup and price the server has now (`GET /artworks` products), or the
  /// draft as it was when the list does not have it.
  static func refreshed(_ product: Product, in artworks: [Artwork]) -> Product {
    guard let summary = artworks.lazy.compactMap({ $0.products?.first { $0.id == product.id } }).first else { return product }
    var fresh = product
    if let mockup = summary.mockupUrl { fresh.mockupUrl = mockup }
    if let preview = summary.previewUrl { fresh.previewUrl = preview }
    if let cents = summary.priceCents { fresh.priceCents = cents }
    if let status = summary.status { fresh.status = status }
    return fresh
  }

  /// A cut saved on Your cutout (`cleanup`): the flow follows it; `cutoutNotice` says when a product
  /// made from the artwork could not be rebuilt or went back to draft (shown on Listing details).
  func recordCut(_ result: CleanupResult) {
    var cut = result.artwork
    if cut.altText?.isEmpty ?? true { cut.altText = cutoutArtwork?.altText }
    cutoutArtwork = cut
    artwork = cut
    cutoutNotice = result.productNotice
  }

  // MARK: Long calls (round 3 ruling 6)

  /// The job for a call about to be sent: the one in flight for the same work (Try again after a
  /// lost answer keeps its `clientRequestId`), else a new one.
  func startJob(_ kind: PendingJob.Kind, now: Date = Date(), knownProductIds: Set<String> = [],
                shownListing: PendingJob.ShownListing? = nil) -> PendingJob {
    if let job = pendingJob, job.kind == kind { return job }
    let job = PendingJob(kind: kind, startedAt: now, clientRequestId: UUID().uuidString,
                         knownProductIds: knownProductIds, shownListing: shownListing)
    pendingJob = job
    return job
  }

  /// The job's answer arrived (or it failed for good): a result applies only while its job is still
  /// the one in flight, so a late answer after a recovery is not applied twice.
  @discardableResult
  func finishJob(_ job: PendingJob) -> Bool {
    guard pendingJob == job else { return false }
    pendingJob = nil
    return true
  }

  /// Back in the app: screens reconcile only a job whose call is no longer waiting for its answer
  /// (it failed, or its answer was lost). A call still in flight is left alone, so a return during
  /// a long build never sends it again (re-review N1).
  func appBecameActive() {
    if pendingJob != nil, callsInFlight == 0 { resumeCount += 1 }
  }

  /// Runs a job's call, counted as in flight until it answers or fails.
  func inFlight<T>(_ call: () async throws -> T) async rethrows -> T {
    callsInFlight += 1
    defer { callsInFlight -= 1 }
    return try await call()
  }

  /// A job's result found on the server.
  enum Recovered {
    case change(ChangeResponse)
    case product(Product)
    case cut(ArtworkDetailResponse)
    case listing(ListingDraft)
  }

  /// What the server already has for `job` (after a lost answer, or on return to the app): a change
  /// child (`GET /artworks`), a product of the artwork and type, a new cut (`GET /artworks/{id}`),
  /// the listing draft (`GET /listings/{id}`). Nil when it is not there (yet), or the server cannot
  /// be reached.
  static func reconcile(_ job: PendingJob, api: APIClient) async -> Recovered? {
    switch job.kind {
    case .change:
      guard let artworks = try? await api.myArtworks(), let child = recoveredChange(in: artworks, job: job) else { return nil }
      let description = ChangeDescription(alt: child.altText, spoken: child.spokenDescription, differences: child.differencesFromPrompt)
      return .change(ChangeResponse(artwork: child, description: description))
    case .product(let artworkId, let type):
      // Review I2: the same request again with the same id answers the product the lost call made
      // (200), or makes it now if that call never landed; never another product.
      if let product = try? await api.createProduct(artworkId: artworkId, type: type, clientRequestId: job.clientRequestId) {
        return .product(product)
      }
      guard let artworks = try? await api.myArtworks(), let product = recoveredProduct(in: artworks, job: job) else { return nil }
      return .product(product)
    case .cut(let id, _, _):
      guard let detail = try? await api.artworkDetail(id: id), recoveredCut(detail, job: job) else { return nil }
      return .cut(detail)
    case .listing(let productId):
      guard let res = try? await api.listing(productId: productId), let draft = res.draft,
            recoveredListing(draft, job: job) else { return nil }
      return .listing(draft)
    }
  }

  /// Device and server clocks differ a little: a child made up to this long before the job started
  /// still counts.
  static let clockSlack: TimeInterval = 120

  /// The change child of the job: its `clientRequestId`, else a child of the same base with the
  /// same instruction created after the job started (the newest).
  static func recoveredChange(in artworks: [Artwork], job: PendingJob) -> Artwork? {
    guard case .change(let baseId, let instruction) = job.kind else { return nil }
    let children = artworks.filter { $0.parentArtworkId == baseId && $0.changeInstruction == instruction }
    if let exact = children.first(where: { $0.clientRequestId == job.clientRequestId }) { return exact }
    let since = job.startedAt.addingTimeInterval(-clockSlack)
    // Review I4: a child made by another attempt (another request id) is not this job's answer.
    return children
      .filter { $0.clientRequestId == nil }
      .compactMap { child in date(child.createdAt).map { (child, $0) } }
      .filter { $0.1 >= since }
      .max { $0.1 < $1.1 }?.0
  }

  /// A product of the job's artwork and type made by this job: not one known when it started (a
  /// draft before a published one; not archived; the list is newest first). Only a second check
  /// after the same request again could not be sent.
  static func recoveredProduct(in artworks: [Artwork], job: PendingJob) -> Product? {
    guard case .product(let artworkId, let type) = job.kind else { return nil }
    let fresh = (artworks.first(where: { $0.id == artworkId })?.products ?? [])
      .filter { $0.type == type && !$0.isArchived && !job.knownProductIds.contains($0.id) }
    guard let found = fresh.first(where: { !$0.isPublished }) ?? fresh.first else { return nil }
    return Product(id: found.id, artworkId: artworkId, type: type, mockupUrl: found.mockupUrl, previewUrl: found.previewUrl,
                   priceCents: found.priceCents, status: found.status)
  }

  /// The listing draft on the server is not the one on screen when the run started (review I3).
  static func recoveredListing(_ draft: ListingDraft, job: PendingJob) -> Bool {
    let title = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !title.isEmpty else { return false }
    guard let shown = job.shownListing else { return true }
    return title != shown.title.trimmingCharacters(in: .whitespacesAndNewlines)
      || (draft.description ?? "") != shown.description
  }

  /// The artwork has a cut-out it did not have when the job started (for `detect`, with the drawings).
  static func recoveredCut(_ detail: ArtworkDetailResponse, job: PendingJob) -> Bool {
    guard case .cut(_, let previous, let needsCandidates) = job.kind,
          let cut = detail.artwork.cleanedUrl, !cut.isEmpty, cut != previous else { return false }
    return !needsCandidates || !detail.candidates.isEmpty
  }

  private static func date(_ iso: String?) -> Date? {
    guard let iso else { return nil }
    let precise = ISO8601DateFormatter()
    precise.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return precise.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
  }
}

/// A long call in flight (round 3 ruling 6): what it makes, when it started and the
/// `clientRequestId` it carries (one per attempt, kept for Try again after a lost answer).
struct PendingJob: Equatable {
  enum Kind: Equatable {
    /// `change` of `baseId` with the instruction.
    case change(baseId: String, instruction: String)
    /// `products` for the artwork and type.
    case product(artworkId: String, type: ProductType)
    /// `detect` (needs the drawings) or `cutout` of the artwork; `previousCut` is its cut-out before.
    case cut(artworkId: String, previousCut: String?, needsCandidates: Bool)
    /// `listings/{id}/run`.
    case listing(productId: String)
  }

  /// The name and description on screen when a listing run started.
  struct ShownListing: Equatable {
    var title: String
    var description: String
  }

  let kind: Kind
  let startedAt: Date
  let clientRequestId: String
  /// Products of the artwork known when a product job started (never its answer).
  var knownProductIds: Set<String> = []
  /// The listing on screen when a listing run started (its answer must differ).
  var shownListing: ShownListing?
}

/// One change in a creation's chain: the result, the art it was made from, what was asked and how
/// the result differs from it.
struct ChangeStep: Equatable {
  var artwork: Artwork
  var base: Artwork
  var instruction: String
  var differences: String?
}

/// A cut-out on Your cutout: the cut artwork, the pieces SAM found on its picture (in pixels of
/// `imageSize`), the piece it was cut from and the box the edge tools send (the Adjust the area
/// frame, or nil for the whole picture).
struct Cut: Equatable {
  var artwork: Artwork
  var candidates: [Candidate]
  var imageSize: ImageSize?
  var selected: [String]
  var box: [Double]?
}
