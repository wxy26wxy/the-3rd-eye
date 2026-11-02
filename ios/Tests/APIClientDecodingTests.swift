import XCTest
@testable import The3rdEye

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

  /// T114: "Change it" sends the instruction (and the words heard) and decodes the child artwork
  /// with its description.
  func testChangeSendsInstructionAndDecodesTheChild() async throws {
    let (api, stub) = client(Fixtures.change, status: 201)
    let res = try await api.change(artworkId: "p1", instruction: "Make the sky purple", transcript: "make the sky purple")
    XCTAssertEqual(stub.requests.first?.url?.path, "/api/v1/artworks/p1/change")
    XCTAssertEqual(stub.requests.first?.httpMethod, "POST")
    XCTAssertGreaterThanOrEqual(stub.requests.first?.timeoutInterval ?? 0, 300)
    let sent = try JSONSerialization.jsonObject(with: stub.requests[0].httpBody!) as? [String: Any]
    XCTAssertEqual(sent?["instruction"] as? String, "Make the sky purple")
    XCTAssertEqual(sent?["transcript"] as? String, "make the sky purple")
    XCTAssertEqual(res.artwork.id, "ch1")
    XCTAssertEqual(res.artwork.parentArtworkId, "p1")
    XCTAssertEqual(res.artwork.changeInstruction, "Make the sky purple")
    XCTAssertNil(res.artwork.cleanedUrl)
    XCTAssertEqual(res.artwork.displayURL?.absoluteString, "https://blob.example/ch1-preview.png", "after = previewUrl")
    XCTAssertEqual(res.description?.alt, "Yellow school bus under a purple sky")
    XCTAssertEqual(res.description?.differences, "")
    XCTAssertEqual(res.artwork.shownDescription, "A yellow school bus under a purple sky.")

    // A typed change sends no transcript.
    _ = try await api.change(artworkId: "ch1", instruction: "Add a sun", transcript: nil)
    let typed = try JSONSerialization.jsonObject(with: stub.requests[1].httpBody!) as? [String: Any]
    XCTAssertNil(typed?["transcript"], "nil transcript is omitted")
  }

  /// T114: the cut-out of a changed picture: the artwork, its pieces (the cut one first) and the size.
  func testCutoutDecodesPiecesAndSize() async throws {
    let (api, stub) = client(Fixtures.cutout)
    let res = try await api.cutout(artworkId: "ch1")
    XCTAssertEqual(stub.requests.first?.url?.path, "/api/v1/artworks/ch1/cutout")
    XCTAssertEqual(stub.requests.first?.httpMethod, "POST")
    XCTAssertGreaterThanOrEqual(stub.requests.first?.timeoutInterval ?? 0, 300)
    XCTAssertEqual(res.artwork.cleanedUrl, "https://blob.example/ch1-cut.png")
    XCTAssertEqual(res.candidates.map(\.id), ["k1", "k2"])
    XCTAssertEqual(res.imageSize, ImageSize(w: 1024, h: 1024))
    // Older shapes without pieces still decode.
    let bare = try JSONDecoder().decode(CutoutResponse.self, from: Data(#"{"artwork":{"id":"ch1"}}"#.utf8))
    XCTAssertTrue(bare.candidates.isEmpty)
    XCTAssertNil(bare.imageSize)
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
      _ = try await api.change(artworkId: "p1", instruction: "x", transcript: nil)
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
