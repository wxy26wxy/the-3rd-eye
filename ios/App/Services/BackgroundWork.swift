import UIKit

/// Where a background-task scope is opened and closed: the app (`UIApplication`), or a test double.
@MainActor
protocol BackgroundTaskHost: AnyObject {
  /// `expiration` runs on the main thread when iOS ends the time it gave.
  func begin(name: String, expiration: @escaping () -> Void) -> UIBackgroundTaskIdentifier
  func end(_ identifier: UIBackgroundTaskIdentifier)
}

/// The app itself.
@MainActor
final class SystemBackgroundHost: BackgroundTaskHost {
  static let shared = SystemBackgroundHost()

  func begin(name: String, expiration: @escaping () -> Void) -> UIBackgroundTaskIdentifier {
    UIApplication.shared.beginBackgroundTask(withName: name) { expiration() }
  }

  func end(_ identifier: UIBackgroundTaskIdentifier) {
    UIApplication.shared.endBackgroundTask(identifier)
  }
}

/// Round 3 ruling 6: a long call (photo upload and `artworks`, `detect`, `cleanup`, `change`,
/// `cutout`, `products`, `listings/run`, `approve`, the story-video upload) asks iOS for time to
/// finish when the creator leaves the app meanwhile. The scope ends when the call returns or throws,
/// or when iOS says the time is up (the call may then fail; the flow reconciles from the server).
enum BackgroundWork {
  /// The host every call uses; tests swap in a recorder.
  @MainActor static var host: BackgroundTaskHost? = SystemBackgroundHost.shared

  static func run<T>(_ name: String, host explicitHost: BackgroundTaskHost? = nil,
                     _ operation: () async throws -> T) async rethrows -> T {
    let scope = await Scope.begin(name, host: explicitHost)
    do {
      let value = try await operation()
      await scope.end()
      return value
    } catch {
      await scope.end()
      throw error
    }
  }

  /// One begin, at most one end (the call returning or the time running out, whichever is first).
  @MainActor
  final class Scope {
    private var host: BackgroundTaskHost?
    private var identifier: UIBackgroundTaskIdentifier = .invalid

    static func begin(_ name: String, host explicitHost: BackgroundTaskHost?) -> Scope {
      let scope = Scope()
      guard let host = explicitHost ?? BackgroundWork.host else { return scope }
      scope.host = host
      scope.identifier = host.begin(name: name) { [weak scope] in
        MainActor.assumeIsolated { scope?.end() }
      }
      return scope
    }

    func end() {
      guard identifier != .invalid else { return }
      host?.end(identifier)
      identifier = .invalid
    }
  }
}
