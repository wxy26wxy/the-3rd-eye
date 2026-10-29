import Foundation

/// Runs an async action now and then every `interval` seconds until stopped.
@MainActor
final class Poller {
  private var task: Task<Void, Never>?
  let interval: Duration

  init(interval: Duration = .seconds(10)) {
    self.interval = interval
  }

  var isRunning: Bool { task != nil }

  func start(_ action: @escaping @MainActor () async -> Void) {
    stop()
    let interval = interval
    task = Task {
      while !Task.isCancelled {
        await action()
        try? await Task.sleep(for: interval)
      }
    }
  }

  func stop() {
    task?.cancel()
    task = nil
  }
}
