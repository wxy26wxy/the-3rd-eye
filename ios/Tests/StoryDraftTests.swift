import XCTest
@testable import MakerStory

final class StoryDraftTests: XCTestCase {
  private func creator(withDraft json: String) throws -> Creator {
    let body = Fixtures.creator.replacingOccurrences(of: #""isExample":true}"#, with: #""isExample":true,"storyDraft":\#(json)}"#)
    return try JSONDecoder().decode(Creator.self, from: Data(body.utf8))
  }

  func testCreatorWithoutDraftStillDecodes() throws {
    XCTAssertNil(try JSONDecoder().decode(Creator.self, from: Data(Fixtures.creator.utf8)).storyDraft)
    XCTAssertNil(try creator(withDraft: "null").storyDraft)
  }

  func testSnakeCaseDraftLikeStoryDraftRoute() throws {
    let draft = try XCTUnwrap(try creator(withDraft: #"{"headline":"Frogs and crowns","bio_short":"I draw frogs.","story_text":"I have drawn frogs since I was six.","provider":"baseten"}"#).storyDraft)
    XCTAssertEqual(draft.headline, "Frogs and crowns")
    XCTAssertEqual(draft.text, "I have drawn frogs since I was six.")
  }

  func testCamelCaseAndBareStringDrafts() throws {
    XCTAssertEqual(try creator(withDraft: #"{"storyText":"Hello."}"#).storyDraft?.text, "Hello.")
    XCTAssertEqual(try creator(withDraft: #"{"bioShort":"Short bio."}"#).storyDraft?.text, "Short bio.", "falls back to the bio")
    XCTAssertEqual(try creator(withDraft: #""Just a story.""#).storyDraft?.text, "Just a story.")
  }

  func testUseSendsStoryText() async throws {
    let stub = StubTransport(body: Fixtures.creator)
    let api = APIClient(baseURL: URL(string: "http://localhost:3000/api/v1")!, transport: stub, token: "t")
    _ = try await api.updateMe(UpdateCreatorRequest(storyText: "My story."))
    let req = try XCTUnwrap(stub.requests.first)
    XCTAssertEqual(req.httpMethod, "PUT")
    XCTAssertEqual(req.url?.path, "/api/v1/creators/me")
    let sent = try JSONSerialization.jsonObject(with: req.httpBody!) as? [String: Any]
    XCTAssertEqual(sent?.keys.sorted(), ["storyText"])
    XCTAssertEqual(sent?["storyText"] as? String, "My story.")
  }
}
