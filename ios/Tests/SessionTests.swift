import AVFoundation
import XCTest
@testable import MakerStory

@MainActor
final class SessionTests: XCTestCase {
  private let base = URL(string: "http://localhost:3000/api/v1")!

  func testWrongCodeShowsServerReasonNotSignInAgain() async {
    let api = APIClient(baseURL: base, transport: StubTransport(status: 401, body: Fixtures.error), token: nil)
    let notCalled = expectation(description: "no sign-out for a wrong code")
    notCalled.isInverted = true
    api.onUnauthorized = { notCalled.fulfill() }
    do {
      try await api.signIn(code: Fixtures.loginCode)
      XCTFail("expected error")
    } catch {
      XCTAssertEqual(error as? APIError, .server(status: 401, code: "invalid_code", message: "That code didn't work."))
    }
    await fulfillment(of: [notCalled], timeout: 0.2)
  }

  func testExpiredTokenClearsSessionAndNotifies() async {
    let api = APIClient(baseURL: base, transport: StubTransport(status: 401, body: Fixtures.expired), token: "old")
    let notified = expectation(description: "onUnauthorized")
    api.onUnauthorized = { notified.fulfill() }
    do {
      _ = try await api.orders(since: nil)
      XCTFail("expected error")
    } catch {
      XCTAssertEqual(error as? APIError, .unauthorized)
    }
    await fulfillment(of: [notified], timeout: 1)
    XCTAssertNil(api.token)
  }

  func testAppStateSignsOutAndMarksExpiry() async {
    let api = APIClient(baseURL: base, transport: StubTransport(status: 401, body: Fixtures.expired), token: "old")
    let app = AppState(api: api)
    XCTAssertTrue(app.isSignedIn)
    app.push(.speak)
    await app.refreshCreator()
    XCTAssertFalse(app.isSignedIn)
    XCTAssertTrue(app.sessionExpired)
    XCTAssertTrue(app.createPath.isEmpty)
  }

  func testAnyRouteExpiryReachesAppState() async throws {
    let api = APIClient(baseURL: base, transport: StubTransport(status: 401, body: Fixtures.expired), token: "old")
    let app = AppState(api: api)
    _ = try? await api.myArtworks()
    // The handler hops to the main actor.
    for _ in 0..<20 where app.isSignedIn { try await Task.sleep(for: .milliseconds(10)) }
    XCTAssertFalse(app.isSignedIn)
    XCTAssertTrue(app.sessionExpired)
  }

  func testPollingStopsAfter401() async throws {
    let stub = StubTransport(status: 401, body: Fixtures.expired)
    let api = APIClient(baseURL: base, transport: stub, token: "old")
    let store = OrdersStore(api: api)
    store.start()
    try await Task.sleep(for: .milliseconds(100))
    XCTAssertEqual(stub.requests.count, 1)
    await store.poll()
    XCTAssertEqual(stub.requests.count, 1, "no request goes out once the token is gone")
    store.stop()
  }

  func testSignInClearsExpiry() async throws {
    let stub = StubTransport(status: 401, body: Fixtures.expired)
    let app = AppState(api: APIClient(baseURL: base, transport: stub, token: "old"))
    await app.refreshCreator()
    XCTAssertTrue(app.sessionExpired)
    stub.status = 200
    stub.body = Fixtures.authCode
    try await app.signIn(code: Fixtures.loginCode)
    XCTAssertTrue(app.isSignedIn)
    XCTAssertFalse(app.sessionExpired)
    app.signOut()
  }
}

@MainActor
final class LifecycleTests: XCTestCase {
  private func app() -> AppState {
    AppState(api: APIClient(baseURL: URL(string: "http://localhost:3000/api/v1")!, transport: StubTransport(body: Fixtures.orders), token: nil))
  }

  func testTabSwitchStopsSpeech() {
    let app = app()
    app.speech.speak("a frog with a crown", force: true)
    XCTAssertTrue(app.speech.isSpeaking)
    app.selectedTab = .orders
    XCTAssertFalse(app.speech.isSpeaking)
  }

  func testSameTabDoesNotStopSpeech() {
    let app = app()
    app.speech.speak("a frog with a crown", force: true)
    app.selectedTab = .create
    XCTAssertTrue(app.speech.isSpeaking)
    app.speech.stop()
  }

  func testBackgroundStopsSpeech() {
    let app = app()
    app.speech.speak("a frog with a crown", force: true)
    app.scenePhaseChanged(.background)
    XCTAssertFalse(app.speech.isSpeaking)
  }

  func testInterruptionClearsSpeaking() {
    let app = app()
    app.speech.speak("a frog with a crown", force: true)
    NotificationCenter.default.post(name: AVAudioSession.interruptionNotification, object: nil,
                                    userInfo: [AVAudioSessionInterruptionTypeKey: AVAudioSession.InterruptionType.began.rawValue])
    XCTAssertFalse(app.speech.isSpeaking)
  }
}

final class TimeoutTests: XCTestCase {
  /// The server gives long routes 270 s; the client must wait longer so it never retries live work.
  func testLongRoutesWaitAtLeast300Seconds() async throws {
    let stub = StubTransport(body: "{}")
    let api = APIClient(baseURL: URL(string: "http://localhost:3000/api/v1")!, transport: stub, token: "t")
    _ = try? await api.generateArtworks(prompt: "p", transcript: nil, product: .sticker, n: 1)
    _ = try? await api.artworkFromPhoto(imageUrl: "u", product: .sticker)
    _ = try? await api.selectCandidate(artworkId: "a", candidateId: "k")
    _ = try? await api.refine(artworkId: "a", instruction: "i")
    _ = try? await api.createProduct(artworkId: "a", type: .tote)
    _ = try? await api.runListingAgent(productId: "p")
    _ = try? await api.approveListing(productId: "p", via: "tap", edits: nil)
    _ = try? await api.saveStoryVideo(pathname: "v", audioPathname: nil, mentionDisability: false)
    XCTAssertEqual(stub.requests.count, 8)
    for req in stub.requests { XCTAssertGreaterThanOrEqual(req.timeoutInterval, 300, req.url?.path ?? "") }
  }
}

final class ConfigTests: XCTestCase {
  func testMissingOrBrokenBaseURLFallsBackToDeployedSite() {
    XCTAssertEqual(AppConfig.siteURL(from: nil), AppConfig.deployedSiteURL)
    XCTAssertEqual(AppConfig.siteURL(from: ""), AppConfig.deployedSiteURL)
    XCTAssertEqual(AppConfig.siteURL(from: "$(API_BASE_URL)"), AppConfig.deployedSiteURL)
    XCTAssertEqual(AppConfig.siteURL(from: "http://localhost:3999").absoluteString, "http://localhost:3999")
    XCTAssertFalse(AppConfig.deployedSiteURL.absoluteString.contains("localhost"))
  }

  func testReleaseDefaultIsNotLocalhost() throws {
    let yml = try String(contentsOf: URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("project.yml"), encoding: .utf8)
    let release = try XCTUnwrap(yml.range(of: "Release:")).upperBound
    let line = try XCTUnwrap(yml[release...].split(separator: "\n").first { $0.contains("API_BASE_URL:") })
    XCTAssertFalse(line.contains("localhost"))
    XCTAssertTrue(line.contains("https://"))
  }
}

final class TolerantDecodingTests: XCTestCase {
  func testPrefsWithMissingKeysUseDefaults() throws {
    let prefs = try JSONDecoder().decode(AccessPrefs.self, from: Data(#"{"highContrast":true}"#.utf8))
    XCTAssertTrue(prefs.highContrast)
    XCTAssertTrue(prefs.speakDescriptions)
    XCTAssertTrue(prefs.voiceFirst)
    XCTAssertFalse(prefs.largeText)
    XCTAssertEqual(try JSONDecoder().decode(AccessPrefs.self, from: Data("{}".utf8)), AccessPrefs())
    XCTAssertEqual(try JSONDecoder().decode(AccessPrefs.self, from: Data(#"{"largeText":"yes"}"#.utf8)).largeText, false, "wrong type keeps the default")
  }

  func testSplitWithMissingKeysUsesDefault() throws {
    let split = try JSONDecoder().decode(Split.self, from: Data(#"{"creator_bps":6000}"#.utf8))
    XCTAssertEqual(split, Split(creatorBps: 6000, orgBps: 3000, productionBps: 2000))
  }

  func testCreatorWithPartialPrefsAndSplitDecodes() throws {
    let json = #"{"id":"c1","accessPrefs":{"largeText":true},"split":{}}"#
    let creator = try JSONDecoder().decode(Creator.self, from: Data(json.utf8))
    XCTAssertEqual(creator.accessPrefs?.largeText, true)
    XCTAssertEqual(creator.split, .default)
  }

  func testPrefsRoundTrip() throws {
    var prefs = AccessPrefs()
    prefs.helperMode = true
    XCTAssertEqual(try JSONDecoder().decode(AccessPrefs.self, from: JSONEncoder().encode(prefs)), prefs)
  }
}
