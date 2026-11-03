import Foundation
import Observation
import SwiftUI

/// The status shown on a My designs tile and its detail screen (docs/api.md, T080 clarification 5).
enum DesignBadge: Equatable {
  /// No cut-out yet, no error, made in the last few minutes: the only state with a spinner.
  case cuttingOut
  /// No cut-out, no error, older than that: a photo whose piece was never picked.
  case needsCutout
  /// `lastError` set and no cut-out.
  case failed
  case draft
  /// At least one product is published.
  case inShop

  /// A request answers within 270 s on the server; after this the row is not being cut any more.
  static let cuttingWindow: TimeInterval = 5 * 60

  static func of(_ artwork: Artwork, now: Date = Date()) -> DesignBadge {
    if artwork.products?.contains(where: \.isPublished) == true { return .inShop }
    guard artwork.cleanedUrl == nil else { return .draft }
    if artwork.lastError != nil { return .failed }
    if let created = parseDate(artwork.createdAt), now.timeIntervalSince(created) < cuttingWindow { return .cuttingOut }
    return .needsCutout
  }

  var title: LocalizedStringKey {
    switch self {
    case .cuttingOut: return "Cutting out…"
    case .needsCutout: return "Needs a cutout"
    case .failed: return "Didn't work"
    case .draft: return "Draft"
    case .inShop: return "In the shop"
    }
  }

  var text: String {
    switch self {
    case .cuttingOut: return String(localized: "Cutting out…")
    case .needsCutout: return String(localized: "Needs a cutout")
    case .failed: return String(localized: "Didn't work")
    case .draft: return String(localized: "Draft")
    case .inShop: return String(localized: "In the shop")
    }
  }

  var symbol: String {
    switch self {
    case .cuttingOut: return "arrow.triangle.2.circlepath"
    case .needsCutout: return "scissors"
    case .failed: return "exclamationmark.triangle"
    case .draft: return "pencil"
    case .inShop: return "checkmark"
    }
  }

  private static func parseDate(_ raw: String?) -> Date? {
    guard let raw else { return nil }
    let withFraction = ISO8601DateFormatter()
    withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return withFraction.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
  }
}

extension Artwork {
  /// Products that are still live (archived ones left the shop with a deleted artwork).
  var liveProducts: [ArtworkProduct] { (products ?? []).filter { !$0.isArchived } }

  /// A cut-out exists, so products can be made from it (the server sets `status: ready` with it).
  var isReadyForProducts: Bool { cleanedUrl != nil }

  /// A product of this type is already in the shop ("Make a sticker" would make a second one).
  func hasPublished(_ type: ProductType) -> Bool {
    liveProducts.contains { $0.type == type && $0.isPublished }
  }
}

/// My designs: the creator's artworks with their products, shared by the grid and the detail screen.
@MainActor
@Observable
final class DesignsStore {
  private let api: APIClient
  private(set) var artworks: [Artwork] = []
  private(set) var loading = false
  private(set) var loaded = false
  var error: String?

  init(api: APIClient) {
    self.api = api
  }

  func artwork(id: String) -> Artwork? { artworks.first { $0.id == id } }

  /// My designs leaves out changes that were never cut out (drafts made by "Change it" that the
  /// creator went past, e.g. with "Back to my original"; docs/api.md T111 §3); everything else is shown.
  static func shown(_ artworks: [Artwork]) -> [Artwork] {
    artworks.filter { !($0.parentArtworkId != nil && $0.cleanedUrl == nil) }
  }

  /// A list fetched less than this long ago is kept as it is (Ruling 3, T144).
  static let freshness: TimeInterval = 30
  /// When the list was last fetched; nil = stale (never fetched, or something changed it).
  private(set) var fetchedAt: Date?
  /// The clock (tests move it).
  var now: () -> Date = Date.init

  /// `GET /artworks`, quietly (Ruling 3, T144): the list on screen stays while it loads, a list
  /// fetched in the last 30 s is not fetched again unless `force` (pull to refresh, Edit listing
  /// saved) or `markStale()` (a creation step, a delete), and only the rows that changed are
  /// replaced, so unchanged tiles keep their pictures.
  func load(force: Bool = false) async {
    if !force, loaded, let fetchedAt, now().timeIntervalSince(fetchedAt) < Self.freshness { return }
    loading = true
    defer { loading = false }
    do {
      let fresh = Self.shown(try await api.myArtworks())
      let merged = Self.merged(old: artworks, new: fresh)
      if merged != artworks { artworks = merged }
      fetchedAt = now()
      loaded = true
      error = nil
    } catch {
      if APIError.isCancellation(error) { return }
      self.error = error.localizedDescription
    }
  }

  /// The next `load()` fetches again (something on the server changed: a creation step, a delete).
  func markStale() { fetchedAt = nil }

  /// The new list, keeping each unchanged row as the same value (rows are `Equatable`).
  static func merged(old: [Artwork], new: [Artwork]) -> [Artwork] {
    let kept = Dictionary(old.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    return new.map { row in kept[row.id] == row ? kept[row.id]! : row }
  }

  /// `DELETE /artworks/{id}`, then the tile goes away (the server keeps it out of later lists).
  /// A 404 means it is already gone (deleted elsewhere), which is what the creator wanted.
  func delete(id: String) async throws {
    do {
      try await api.deleteArtwork(id: id)
    } catch APIError.server(404, _, _) {
      // Already deleted.
    }
    artworks.removeAll { $0.id == id }
    markStale()
  }

  /// A new cut-out from Re-do the cutout: keeps the products the list already knows.
  func replace(_ artwork: Artwork) {
    guard let index = artworks.firstIndex(where: { $0.id == artwork.id }) else { return }
    var updated = artwork
    if updated.products == nil { updated.products = artworks[index].products }
    artworks[index] = updated
  }

  /// A listing saved from Edit listing: the product is published with its new title.
  func listingSaved(productId: String, title: String?, status: String?, priceCents: Int? = nil, description: String? = nil) {
    for index in artworks.indices {
      guard var products = artworks[index].products, let p = products.firstIndex(where: { $0.id == productId }) else { continue }
      if let title { products[p].title = title }
      if let status { products[p].status = status }
      if let priceCents { products[p].priceCents = priceCents }
      if let description { products[p].description = description }
      artworks[index].products = products
    }
  }

  func reset() {
    artworks = []
    loaded = false
    fetchedAt = nil
    error = nil
  }
}

/// The one action Design detail pins in its bottom bar (boards `2016:1178`, `2016:1284`):
/// the shop page of the first live product; else "Make a sticker" (or "Make a tote") when the
/// cut-out is ready; else "Re-do the cutout" (failed, needs a cutout, still cutting). Nil = none.
enum DesignPrimaryAction: Equatable {
  case shop(String)
  case make(ProductType)
  case redo

  static func of(_ artwork: Artwork) -> DesignPrimaryAction? {
    if let first = artwork.liveProducts.first(where: \.isPublished) { return .shop(first.id) }
    guard artwork.isReadyForProducts else { return .redo }
    if !artwork.hasPublished(.sticker) { return .make(.sticker) }
    if !artwork.hasPublished(.tote) { return .make(.tote) }
    return nil
  }
}
