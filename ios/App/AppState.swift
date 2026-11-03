import Observation
import os
import SwiftUI

enum HomeTab: Hashable { case create, designs, orders, messages }

/// Pushed screens of the creator flow (root is PickProductView). Photo first, round 4 order (T141):
/// camera → Adjust the area (the local photo, no upload) → Making your cutout (the crop uploaded,
/// `POST /artworks {framed: true}`) → Your cutout → Change it (the product made here) → [Changing
/// your art → Before and after] → Listing details. "Fix the cutout" opens Your cutout of the art on
/// screen, whose "Use this" returns to Change it.
/// Round 4 ruling 2: the product is made on Change it (making state) and rebuilt by every change
/// (Changing = change → cutout → products), so Change it and Before and after show product photos.
/// "My story video" (T122) also opens from the root.
enum CreateRoute: Hashable {
  case chooseMethod
  case camera(PhotoSource)
  /// The frame on the local photo (the whole photo at first); "Use this area" goes on to Making your cutout.
  case adjustArea
  /// The product photo (made here first: the making state), what to change, or keep it as it is.
  case changeIt
  /// Loading screen while the art is changed, cut out and made into the product (three lines).
  case changing
  /// The two product photos, before and after the change.
  case beforeAfter
  /// Loading screen while the crop of the frame is uploaded and cut (`POST /artworks {framed: true}`).
  case makingCutout(CutJob)
  /// The cut-out of the artwork with this id (the crop, or a change), with the edge tools.
  case yourCutout(String)
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
  /// Adjust the area's frame (round 4): `[x0, y0, x1, y1]` in pixels of the local photo. The photo
  /// is cropped to it on the device, the crop uploaded and `POST /artworks {framed: true}` cuts out
  /// the largest drawing in it.
  case area([Double])
}

enum PhotoSource: Hashable { case camera, library }

/// Pushed screens of the My designs tab.
enum DesignRoute: Hashable {
  case detail(String)
  /// Your cutout for a saved design (`AppState.designFlow`, round 4: marks on the stored crop, no
  /// re-frame); "Use this" comes back to the detail.
  case yourCutout(String)
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
  var flow = CreateFlow() {
    didSet { watchProducts(of: flow) }
  }
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
    watchProducts(of: flow)
  }

  /// A product made (or rebuilt) in a creation: My designs fetches its list again on its next
  /// appearance (review M7), not up to 30 s later.
  private func watchProducts(of flow: CreateFlow) {
    flow.onProductMade = { [weak self] in self?.designs.markStale() }
    flow.onRowDropped = { [weak self] in self?.designs.markStale() }
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

  /// Every step of a creation may have changed a row on the server (a new photo, cut, change,
  /// product or listing): My designs fetches its list again next time (Ruling 3, T144).
  func push(_ route: CreateRoute) {
    designs.markStale()
    createPath.append(route)
  }

  /// Replaces the top screen (used by loading screens so Back skips them).
  func replaceTop(with route: CreateRoute) {
    designs.markStale()
    if !createPath.isEmpty { createPath.removeLast() }
    createPath.append(route)
  }

  func popToRoot() { createPath = [] }

  /// "Make a sticker / Make a tote" on a saved design: a new creation from that artwork. A draft
  /// product of that type is reused (straight to Listing details); without one, Change it opens in
  /// the making state (round 4 ruling 2: the product is made there).
  func continueFrom(artwork: Artwork, productType: ProductType) {
    let next = CreateFlow()
    var art = artwork
    art.products = nil
    next.photoArtwork = art
    next.pieceArtwork = art
    next.artwork = art
    next.productType = productType
    if let draft = artwork.liveProducts.first(where: { $0.type == productType && !$0.isPublished }) {
      next.useProduct(Product(id: draft.id, artworkId: artwork.id, type: productType, mockupUrl: draft.mockupUrl,
                              previewUrl: draft.previewUrl, priceCents: draft.priceCents, status: draft.status), madeFrom: art)
      next.productTitle = draft.title
      next.productDescription = draft.description
      createPath = [.listingDetails]
    } else {
      createPath = [.changeIt]
    }
    flow = next
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

  /// "Re-do the cutout" after a resolution refusal (round 4): Adjust the area on the local photo
  /// while it is still in this creation, else Your cutout (marks on the stored crop) with "Take a
  /// new photo".
  func backToArea() {
    if flow.photo != nil, let index = createPath.lastIndex(of: .adjustArea) {
      createPath = Array(createPath.prefix(through: index))
      return
    }
    backToCutout()
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
  /// The crop's artwork (`POST /artworks {framed: true}`), its drawings and the stored crop's size.
  var photoArtwork: Artwork?
  var photoCandidates: [Candidate] = []
  var photoImageSize: ImageSize?
  /// The drawing cut out of the crop (the server's first cut, or a pick / marks on Your cutout) and
  /// the drawing it was cut from.
  var pieceArtwork: Artwork?
  var pieceCutFrom: String?
  /// The frame on the local photo (pixels of `photo`) that `photoArtwork` was made from.
  var cropBox: [Double]?
  /// The last frame set on Adjust the area (Back to it starts there).
  var areaBox: [Double]?
  /// The crop already uploaded for a frame (Try again, or the same frame again, needs no second upload).
  var cropUpload: CropUpload?
  /// Nothing was found in the crop: Adjust the area shows this when it comes back on screen.
  var areaError: String?
  /// The frame whose crop had nothing in it (review M5): the same frame again sends nothing.
  var emptyBox: [Double]?
  /// T146: the photo row the re-frame in progress began from (deleted once the new row exists), the
  /// row that answered `422 no_drawing_found` (deleted on the next "Use this area" or "Take a new
  /// photo"), and the rows already sent to `DELETE` (never twice).
  var supersedes: String?
  var emptyRowId: String?
  private(set) var droppedRows: Set<String> = []
  /// Called after a row was deleted (My designs fetches its list again).
  var onRowDropped: (() -> Void)?
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
  /// The art the listing is for ("Looks good as is": the cut on screen).
  var artwork: Artwork?
  /// The product of `artwork` (Listing details).
  var product: Product?
  /// Products made in this creation (of `productType`), per artwork id, and the cut-out
  /// (`cleanedUrl`) each was made from, so a re-cut is noticed before one is reused (ruling 2).
  var products: [String: Product] = [:]
  var productCuts: [String: String] = [:]
  /// The change Changing is making (round 4 ruling 2): kept out of the chain until its cut-out and
  /// product exist, so Change it never shows a change without its product.
  var changeInProgress: ChangeStep?
  /// Listing title of a reused draft product (`continueFrom`), shown in Listing details.
  var productTitle: String?
  /// Listing description of that draft, when the server sent it.
  var productDescription: String?
  var approval: ApproveListingResponse?
  /// The picked story video was longer than 30 s and only its start was kept.
  var storyVideoTrimmed = false

  /// The art the creator sees now: the change on screen, else the picked drawing.
  var currentArt: Artwork? { changedArtwork ?? pieceArtwork }

  /// The cut-out of the art on screen (what its product is made from): the change's cut-out, else
  /// the piece. Nil for a change that was never cut out.
  var currentCut: Artwork? {
    if let change = changedArtwork { return changeCuts[change.id]?.artwork }
    return pieceArtwork?.cleanedUrl != nil ? pieceArtwork : nil
  }

  /// The product of a cut-out that is ready to show (made from that very cut).
  func readyProduct(for art: Artwork?) -> Product? {
    guard let art, let made = products[art.id], productCuts[art.id] == art.cleanedUrl else { return nil }
    return made
  }

  /// The cut-out known for an artwork id (the piece, a change's cut-out, or the listing's art).
  func cutArtwork(_ id: String) -> Artwork? {
    cut(for: id)?.artwork ?? (artwork?.id == id ? artwork : nil)
  }

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

  /// The cut Your cutout shows for `artworkId`: the crop's piece, or a change's cut-out. Round 4:
  /// the box is the whole picture for both (the server only has the crop).
  func cut(for artworkId: String) -> Cut? {
    if artworkId == photoArtwork?.id {
      guard let piece = pieceArtwork, piece.cleanedUrl != nil else { return nil }
      return Cut(artwork: piece, candidates: photoCandidates, imageSize: photoImageSize.flatMap { $0.isUsable ? $0 : nil },
                 selected: pieceCutFrom.map { [$0] } ?? [], box: nil)
    }
    return changeCuts[artworkId]
  }

  /// The local photo's size in pixels (the frame's coordinate space on Adjust the area).
  var localPhotoSize: ImageSize? {
    guard let photo else { return nil }
    let size = ImageSize(w: photo.size.width * photo.scale, h: photo.size.height * photo.scale)
    return size.isUsable ? size : nil
  }

  /// A new cut of `artworkId` (Making your cutout, or Apply cutout): the flow follows it.
  func recordCut(of artworkId: String, _ cut: Artwork, request: CleanupRequest? = nil) {
    if artworkId == photoArtwork?.id {
      if let ids = request?.candidateIds, let first = ids.first { pieceCutFrom = first }
      pieceArtwork = cut
      updateChange(cut)
    } else {
      changeCuts[artworkId]?.artwork = cut
      if let ids = request?.candidateIds, !ids.isEmpty { changeCuts[artworkId]?.selected = ids }
      updateChange(cut)
    }
  }

  /// The answer for the crop of `box` (`POST /artworks {framed: true}`): a new row with the drawings
  /// found in it and the largest cut out. The changes made from an earlier crop go.
  func recordPhoto(_ res: PhotoArtworkResponse, box: [Double]) {
    setPhoto(artwork: res.artwork, candidates: res.candidates, imageSize: res.imageSize)
    cropBox = box
    if res.artwork.cleanedUrl != nil {
      pieceArtwork = res.artwork
      pieceCutFrom = res.candidates.first?.id
    }
  }

  // MARK: Superseded and failed crop rows (T146)

  /// A row with a published product is never deleted (what the flow knows; unknown = no product).
  func hasPublishedProduct(_ artworkId: String) -> Bool {
    if products[artworkId]?.status == "published" { return true }
    if let product, product.artworkId == artworkId, product.status == "published" { return true }
    for art in [photoArtwork, pieceArtwork, artwork] {
      if let art, art.id == artworkId, art.liveProducts.contains(where: \.isPublished) { return true }
    }
    return false
  }

  /// Soft-deletes a superseded or failed photo row (`DELETE /artworks/{id}`) in the background. A
  /// failure is logged and ignored: it never blocks the flow. Nil when nothing is sent (already
  /// sent, or the row has a published product).
  @discardableResult
  func dropRow(_ artworkId: String, api: APIClient) -> Task<Void, Never>? {
    guard !droppedRows.contains(artworkId), !hasPublishedProduct(artworkId) else { return nil }
    droppedRows.insert(artworkId)
    let done = onRowDropped
    return Task { @MainActor in
      do {
        try await api.deleteArtwork(id: artworkId)
        done?()
      } catch {
        Logger(subsystem: "com.the3rdeye.app", category: "flow").warning("Could not delete the earlier upload: \(error.localizedDescription, privacy: .public)")
      }
    }
  }

  /// Making your cutout is about to create a row for a new crop: the photo row on hand is the one
  /// it replaces (kept through a failed or empty attempt in between).
  func beginReframe() {
    guard supersedes == nil, let id = photoArtwork?.id, id != emptyRowId, !droppedRows.contains(id) else { return }
    supersedes = id
  }

  /// The new crop's row exists: only now is the row it replaces deleted.
  @discardableResult
  func dropSuperseded(except newId: String, api: APIClient) -> Task<Void, Never>? {
    defer { supersedes = nil }
    guard let old = supersedes, old != newId else { return nil }
    return dropRow(old, api: api)
  }

  /// "Use this area": the row that answered 422 goes, whether or not the frame changed.
  @discardableResult
  func dropEmptyRow(api: APIClient) -> Task<Void, Never>? {
    guard let id = emptyRowId else { return nil }
    emptyRowId = nil
    return dropRow(id, api: api)
  }

  /// "Take a new photo": the 422 row and the earlier piece row the re-frame began from go.
  @discardableResult
  func dropRowsOnRetake(api: APIClient) -> [Task<Void, Never>] {
    var tasks: [Task<Void, Never>] = []
    if let t = dropEmptyRow(api: api) { tasks.append(t) }
    if let old = supersedes, let t = dropRow(old, api: api) { tasks.append(t) }
    supersedes = nil
    return tasks
  }

  /// An answer nobody wants any more (the photo was discarded meanwhile): its own new row goes. The
  /// row the flow holds (a recovery applied it) stays.
  @discardableResult
  func dropIfStale(_ artworkId: String, api: APIClient) -> Task<Void, Never>? {
    guard photoArtwork?.id != artworkId, emptyRowId != artworkId else { return nil }
    return dropRow(artworkId, api: api)
  }

  // MARK: Route table (T131)

  /// Adjust the area › "Use this area" (round 4): the frame already cut (same photo, same frame)
  /// goes straight to Your cutout; any other frame is cropped, uploaded and cut on Making your
  /// cutout (a new row each time).
  func routeAfterArea(box: [Double]) -> CreateRoute? {
    guard photo != nil, box != emptyBox else { return nil }
    if let photoId = photoArtwork?.id, cropBox == box, pieceArtwork?.cleanedUrl != nil {
      supersedes = nil
      return .yourCutout(photoId)
    }
    return .makingCutout(.area(box))
  }

  /// Your cutout › "Use this" (ruling 2): Change it on that art (the piece, or the change it is the
  /// cut-out of), which shows its product photo, making it first when there is none for this cut.
  func routeAfterCutout(of artworkId: String) -> CreateRoute? {
    guard let cut = cut(for: artworkId), cut.artwork.cleanedUrl != nil else { return nil }
    if changes.contains(where: { $0.artwork.id == artworkId }) {
      changedArtworkId = artworkId
    } else if artworkId == photoArtwork?.id {
      changedArtworkId = nil
    }
    return .changeIt
  }

  /// Change it › "Looks good as is" (ruling 2): the listing for the product on screen; no call.
  func routeAfterLooksGood() -> CreateRoute? {
    guard let art = currentCut, let made = readyProduct(for: art) else { return nil }
    artwork = art
    product = made
    return .listingDetails
  }

  /// A new row for the crop: its drawings and the stored crop's size.
  func setPhoto(artwork: Artwork, candidates: [Candidate], imageSize: ImageSize?) {
    photoArtwork = artwork
    photoCandidates = candidates
    photoImageSize = imageSize
    areaError = nil
    pieceArtwork = nil
    pieceCutFrom = nil
    cropBox = nil
    resetChange()
  }

  /// No changes: the art is the picked piece again, and the changes' cut-outs go.
  func resetChange() {
    pendingJob = nil
    changeInProgress = nil
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
    cropBox = nil
    areaBox = nil
    emptyBox = nil
    cropUpload = nil
    supersedes = nil
    emptyRowId = nil
    resetChange()
    resetCutout(artwork: nil, candidates: [], imageSize: nil)
    artwork = nil
    product = nil
    products = [:]
    productCuts = [:]
  }

  // MARK: Product for this cut-out

  /// What Change it's making state does: make the product, reuse the draft it already made for this
  /// artwork (no call: the photo shows at once), or reuse it after a re-cut, when the server has
  /// rebuilt its print file and mockup and the client must read them again.
  enum ProductPlan: Equatable {
    case create
    case reuse(Product)
    case refresh(Product)
  }

  func productPlan(for artwork: Artwork, type: ProductType) -> ProductPlan {
    guard let made = products[artwork.id], made.type == nil || made.type == type else { return .create }
    return productCuts[artwork.id] == artwork.cleanedUrl ? .reuse(made) : .refresh(made)
  }

  /// Records the product made (or refreshed) from `artwork`'s current cut-out.
  func useProduct(_ product: Product, madeFrom artwork: Artwork) {
    products[artwork.id] = product
    productCuts[artwork.id] = artwork.cleanedUrl
    if self.artwork?.id == artwork.id { self.product = product }
    onProductMade?()
  }

  /// Called after every `useProduct` (AppState: My designs is stale).
  @ObservationIgnored var onProductMade: (() -> Void)?

  /// A `cleanup` (or `cutout`) answer's `products` (T143): the product made from `artwork` follows
  /// its rebuilt pictures and the new cut; a draft of this type the creation did not know yet (a
  /// saved design's) is taken as its product, so no second one is made.
  func applyRebuilt(_ summaries: [ArtworkProduct], for artwork: Artwork) {
    let live = summaries.filter { !$0.isArchived && ($0.type == nil || $0.type == productType) }
    let known = products[artwork.id]
    guard let fresh = known.flatMap({ made in live.first { $0.id == made.id } }) ?? live.first(where: { !$0.isPublished }) else { return }
    var product = known ?? Product(id: fresh.id, artworkId: artwork.id, type: fresh.type ?? productType)
    if let mockup = fresh.mockupUrl { product.mockupUrl = mockup }
    if let preview = fresh.previewUrl { product.previewUrl = preview }
    if let cents = fresh.priceCents { product.priceCents = cents }
    if let status = fresh.status { product.status = status }
    useProduct(product, madeFrom: artwork)
  }

  /// Products already known for `artwork` when a product job starts (never that job's answer).
  func knownProductIds(of artwork: Artwork) -> Set<String> {
    var ids = Set((artwork.products ?? []).map(\.id))
    if let product { ids.insert(product.id) }
    for made in products.values { ids.insert(made.id) }
    return ids
  }

  /// The product of `art` for this creation (ruling 2): reused, read again after a re-cut, or made
  /// with `POST /products` (one `clientRequestId` per attempt; a lost answer is asked again with the
  /// same id). Counted as in flight while the call waits.
  func makeProduct(for art: Artwork, type: ProductType, api: APIClient) async throws -> Product {
    switch productPlan(for: art, type: type) {
    case .reuse(let made):
      return made
    case .refresh(let draft):
      let fresh = CreateFlow.refreshed(draft, in: try await api.myArtworks())
      useProduct(fresh, madeFrom: art)
      return fresh
    case .create:
      let job = startJob(.product(artworkId: art.id, type: type), knownProductIds: knownProductIds(of: art))
      do {
        let made = try await inFlight {
          try await api.createProduct(artworkId: art.id, type: type, clientRequestId: job.clientRequestId)
        }
        if finishJob(job) { useProduct(made, madeFrom: art) }
        return products[art.id] ?? made
      } catch {
        if APIError.isCancellation(error) { throw error }
        if case APIError.transport = error {
          if let found = await recoverProduct(api: api) { return found }
        } else {
          finishJob(job)
        }
        throw error
      }
    }
  }

  /// A product job whose answer was lost (or a return to the app): the product the server made,
  /// recorded once. Nil when there is none (yet) or a call is still waiting.
  @discardableResult
  func recoverProduct(api: APIClient) async -> Product? {
    guard let job = pendingJob, case .product(let artworkId, _) = job.kind, callsInFlight == 0,
          let art = cutArtwork(artworkId) ?? (changeInProgress.flatMap { changeCuts[$0.artwork.id]?.artwork }),
          case .product(let made)? = await CreateFlow.reconcile(job, api: api),
          finishJob(job) else { return nil }
    useProduct(made, madeFrom: art)
    return made
  }

  /// A change's cut-out (`cutout`, Changing's second step): its pieces stay with it, the largest
  /// (`candidates[0]`) is the one cut, as the edge tools send it.
  func recordChangeCut(_ id: String, _ artwork: Artwork, candidates: [Candidate], size: ImageSize?, art: Artwork?) {
    var cut = artwork
    cut.products = nil
    if cut.altText?.isEmpty ?? true { cut.altText = art?.altText }
    if cut.spokenDescription?.isEmpty ?? true { cut.spokenDescription = art?.spokenDescription }
    changeCuts[id] = Cut(artwork: cut, candidates: candidates, imageSize: size,
                         selected: candidates.first.map { [$0.id] } ?? [], box: nil)
    updateChange(cut)
    if changeInProgress?.artwork.id == id { changeInProgress?.artwork = cut }
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
                knownArtworkIds: Set<String> = [], shownListing: PendingJob.ShownListing? = nil) -> PendingJob {
    if let job = pendingJob, job.kind == kind { return job }
    let job = PendingJob(kind: kind, startedAt: now, clientRequestId: UUID().uuidString,
                         knownProductIds: knownProductIds, knownArtworkIds: knownArtworkIds, shownListing: shownListing)
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
    case photo(ArtworkDetailResponse)
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
    case .photo:
      guard let artworks = try? await api.myArtworks(), let row = recoveredPhoto(in: artworks, job: job),
            let detail = try? await api.artworkDetail(id: row.id) else { return nil }
      return .photo(detail)
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

  /// The crop's row made by a photo job whose answer was lost: a photo row (not a change) created
  /// after the job started, not known then, the newest. Its cut may be missing (nothing found).
  ///
  /// Review I1: the server stores the row before it looks for drawings (10–25 s), so a row with no
  /// cut and no `lastError` is still being cut: not an answer yet (nil; the job stays pending and
  /// is looked for again on Try again or the next return to the app). `lastError` set means it is
  /// done (`no_drawing_found`: nothing in the crop).
  static func recoveredPhoto(in artworks: [Artwork], job: PendingJob) -> Artwork? {
    guard let newest = newestPhotoRow(in: artworks, job: job), !isBeingCut(newest) else { return nil }
    return newest
  }

  /// The newest photo row created after the photo job started that was not known then, done or not.
  static func newestPhotoRow(in artworks: [Artwork], job: PendingJob) -> Artwork? {
    guard case .photo = job.kind else { return nil }
    let since = job.startedAt.addingTimeInterval(-clockSlack)
    return artworks
      .filter { $0.parentArtworkId == nil && ($0.source ?? "photo") == "photo" && !job.knownArtworkIds.contains($0.id) }
      .compactMap { row in date(row.createdAt).map { (row, $0) } }
      .filter { $0.1 >= since }
      .max { $0.1 < $1.1 }?.0
  }

  /// A photo row the server is still cutting: no cut-out and no `lastError` yet.
  static func isBeingCut(_ row: Artwork) -> Bool { row.cleanedUrl == nil && row.lastError == nil }

  /// `lastError` of a photo row whose crop had nothing to cut (T143).
  static let noDrawingFound = "no_drawing_found"

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
    /// `cutout` of the artwork; `previousCut` is its cut-out before.
    case cut(artworkId: String, previousCut: String?, needsCandidates: Bool)
    /// The crop of the frame `box` (local photo pixels): upload + `POST /artworks {framed: true}`.
    case photo(box: [Double])
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
  /// Artworks known when a photo job started (never its answer).
  var knownArtworkIds: Set<String> = []
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
/// `imageSize`), the piece it was cut from and the box the edge tools send (nil = the whole
/// picture, which is every box since round 4).
struct Cut: Equatable {
  var artwork: Artwork
  var candidates: [Candidate]
  var imageSize: ImageSize?
  var selected: [String]
  var box: [Double]?
}

/// The crop uploaded for a frame (pixels of the local photo) and its Blob URL.
struct CropUpload: Equatable {
  let box: [Double]
  let url: String
}
