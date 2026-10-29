import XCTest
@testable import MakerStory

final class APIClientDecodingTests: XCTestCase {
  private let base = URL(string: "http://localhost:3000/api/v1")!

  private func client(_ body: String, status: Int = 200) -> (APIClient, StubTransport) {
    let stub = StubTransport(status: status, body: body)
    return (APIClient(baseURL: base, transport: stub, token: "t0k"), stub)
  }

  func testCreatorDecodesPrefsAndSplit() throws {
    let creator = try JSONDecoder().decode(Creator.self, from: Data(Fixtures.creator.utf8))
    XCTAssertEqual(creator.displayName, "Leo")
    XCTAssertEqual(creator.split, Split(creatorBps: 5000, orgBps: 3000, productionBps: 2000))
    XCTAssertEqual(creator.accessPrefs?.simpleMode, true)
    XCTAssertNil(creator.storyVideoUrl)
  }

  func testShapePromptSnakeCaseAndNullQuestion() async throws {
    let (api, stub) = client(Fixtures.shapeWithQuestion)
    let res = try await api.shapePrompt(transcript: "a frog", answers: nil, product: .sticker)
    XCTAssertEqual(res.clarifyingQuestion, "What color should the crown be?")
    XCTAssertEqual(res.styleNotes, "bold sticker style")
    XCTAssertEqual(stub.requests.first?.url?.path, "/api/v1/prompts/shape")
    let sent = try JSONSerialization.jsonObject(with: stub.requests[0].httpBody!) as? [String: Any]
    XCTAssertEqual(sent?["product"] as? String, "sticker")
    XCTAssertNil(sent?["answers"], "nil answers are omitted")

    let none = try JSONDecoder().decode(ShapePromptResponse.self, from: Data(Fixtures.shapeNoQuestion.utf8))
    XCTAssertNil(none.clarifyingQuestion)
  }

  func testTextToImageVariants() async throws {
    let (api, stub) = client(Fixtures.artworkVariants)
    let variants = try await api.generateArtworks(prompt: "A frog", transcript: "a frog", product: .tote, n: 2)
    XCTAssertEqual(variants.count, 2)
    XCTAssertEqual(variants[0].spokenDescription, "A smiling green frog wears a small gold crown.")
    XCTAssertEqual(variants[0].displayURL?.absoluteString, "https://blob.example/a1-preview.png")
    let sent = try JSONSerialization.jsonObject(with: stub.requests[0].httpBody!) as? [String: Any]
    XCTAssertEqual(sent?["source"] as? String, "text2image")
    XCTAssertEqual(sent?["n"] as? Int, 2)
  }

  func testPhotoArtworkCandidates() throws {
    let res = try JSONDecoder().decode(PhotoArtworkResponse.self, from: Data(Fixtures.photoArtwork.utf8))
    XCTAssertEqual(res.candidates.count, 2)
    XCTAssertEqual(res.candidates[1].bbox, [400.5, 30, 700, 380])
    XCTAssertNil(res.artwork.cleanedUrl)
  }

  func testProductListingRunAndApprove() throws {
    let product = try JSONDecoder().decode(Product.self, from: Data(Fixtures.product.utf8))
    XCTAssertEqual(product.type, .sticker)
    XCTAssertEqual(product.priceCents, 500)

    let run = try JSONDecoder().decode(ListingRunResponse.self, from: Data(Fixtures.listingRun.utf8))
    XCTAssertEqual(run.listing.priceCents, 600)
    XCTAssertEqual(run.listing.printOk, true)
    XCTAssertEqual(run.trace?.first?.args, .object(["dpi": .number(300)]))

    let approved = try JSONDecoder().decode(ApproveListingResponse.self, from: Data(Fixtures.approve.utf8))
    XCTAssertTrue(approved.storyVideoNeeded)
    XCTAssertEqual(approved.listing.approvedVia, "voice")
  }

  func testOrdersSinceQueryAndDecoding() async throws {
    let (api, stub) = client(Fixtures.orders)
    let res = try await api.orders(since: "2026-10-28T22:00:00Z")
    XCTAssertEqual(res.unread, 2)
    XCTAssertEqual(res.orders.first?.creatorShareCents, 300)
    let url = try XCTUnwrap(stub.requests.first?.url)
    XCTAssertEqual(url.path, "/api/v1/orders")
    XCTAssertEqual(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first?.value, "2026-10-28T22:00:00Z")
    XCTAssertEqual(stub.requests.first?.value(forHTTPHeaderField: "Authorization"), "Bearer t0k")
  }

  func testOrderDetailWithNullThankYou() throws {
    let res = try JSONDecoder().decode(OrderDetailResponse.self, from: Data(Fixtures.orderDetail.utf8))
    XCTAssertNil(res.thankYou)
    XCTAssertEqual(res.order.token, "ABCDEFGHJKMN")
    XCTAssertEqual(res.messages?.first?.isFromCreator, false)
  }

  func testSmallEnvelopes() throws {
    XCTAssertEqual(try JSONDecoder().decode(ThankYouDraftResponse.self, from: Data(Fixtures.thankYouDraft.utf8)).draftText, "Thank you, Sam!")
    XCTAssertEqual(try JSONDecoder().decode(StoryPromptsResponse.self, from: Data(Fixtures.storyPrompts.utf8)).prompts.count, 3)
    XCTAssertEqual(try JSONDecoder().decode(TranscribeResponse.self, from: Data(Fixtures.transcribe.utf8)).text, "a frog with a crown")
    XCTAssertEqual(try JSONDecoder().decode(AuthCodeResponse.self, from: Data(Fixtures.authCode.utf8)).token, "c1.abc123")
  }

  func testErrorEnvelopeBecomesServerError() async {
    let (api, _) = client(Fixtures.error, status: 400)
    do {
      _ = try await api.shapePrompt(transcript: "x", answers: nil, product: .sticker)
      XCTFail("expected error")
    } catch let error as APIError {
      XCTAssertEqual(error, .server(status: 400, code: "invalid_code", message: "That code didn't work."))
    } catch {
      XCTFail("unexpected \(error)")
    }
  }

  func testUnauthorized() async {
    let (api, _) = client(Fixtures.error, status: 401)
    do {
      _ = try await api.me()
      XCTFail("expected error")
    } catch {
      XCTAssertEqual(error as? APIError, .unauthorized)
    }
  }
}
