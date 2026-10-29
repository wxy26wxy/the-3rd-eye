import Observation
import Foundation

/// Orders inbox kept fresh by polling `GET /orders?since=` every 10 s.
@MainActor
@Observable
final class OrdersStore {
  private let api: APIClient
  private let poller = Poller(interval: .seconds(10))
  private(set) var orders: [OrderSummary] = []
  private(set) var unread = 0
  private(set) var lastError: String?
  private(set) var loaded = false
  private var since: String?

  init(api: APIClient) {
    self.api = api
  }

  func start() {
    guard !poller.isRunning else { return }
    poller.start { [weak self] in await self?.poll() }
  }

  func stop() { poller.stop() }

  /// Stops polling and forgets everything (sign out / account switch).
  func reset() {
    poller.stop()
    orders = []
    unread = 0
    lastError = nil
    loaded = false
    since = nil
  }

  /// Full reload (pull to refresh).
  func refresh() async {
    since = nil
    await poll()
  }

  func poll() async {
    guard api.isSignedIn else { return }
    do {
      let res = try await api.orders(since: since)
      merge(res.orders, replacing: since == nil)
      unread = res.unread ?? orders.reduce(0) { $0 + ($1.unreadMessages ?? 0) + ($1.hasThankYou == false ? 1 : 0) }
      lastError = nil
      loaded = true
    } catch APIError.unauthorized {
      // Session ended: stop asking (AppState signs out and resets this store).
      poller.stop()
    } catch is CancellationError {
      return
    } catch {
      lastError = error.localizedDescription
      loaded = true
    }
  }

  func merge(_ incoming: [OrderSummary], replacing: Bool) {
    var byId = replacing ? [:] : Dictionary(uniqueKeysWithValues: orders.map { ($0.id, $0) })
    for order in incoming { byId[order.id] = order }
    orders = byId.values.sorted { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
    if let newest = orders.compactMap(\.createdAt).max() { since = newest }
  }
}
