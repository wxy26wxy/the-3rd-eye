import XCTest
@testable import The3rdEye

/// Adjust the area (T122 R2): the frame's start, drags, VoiceOver actions and clamping, in pixels
/// of a 1200 × 1600 original.
final class AreaFrameTests: XCTestCase {
  private let size = ImageSize(w: 1200, h: 1600)
  private let piece = Candidate(id: "c1", bbox: [100, 160, 500, 693])

  private func assertBox(_ frame: AreaFrame, _ expected: [Double], accuracy: Double = 0.01, file: StaticString = #filePath, line: UInt = #line) {
    for (a, b) in zip(frame.box, expected) { XCTAssertEqual(a, b, accuracy: accuracy, file: file, line: line) }
  }

  // MARK: Start

  func testStartsOnThePieceGrownByEightPercent() {
    // 400 × 533 grows by 32 × 42.64: 16 and 21.32 px on each side.
    assertBox(AreaFrame.initial(piece: piece, image: size), [84, 138.68, 516, 714.32])
  }

  func testGrowthStopsAtThePhotoEdge() {
    let edge = Candidate(id: "e", bbox: [0, 10, 1200, 1600])
    assertBox(AreaFrame.initial(piece: edge, image: size), [0, 0, 1200, 1600])
  }

  func testNoDrawingStartsOnTheWholePhoto() {
    XCTAssertEqual(AreaFrame.initial(piece: nil, image: size), .whole(size))
    XCTAssertEqual(AreaFrame.initial(piece: Candidate(id: "x", bbox: [1, 2]), image: size), .whole(size), "a malformed bbox")
    XCTAssertEqual(AreaFrame.initial(piece: Candidate(id: "x", bbox: [5, 5, 5, 9]), image: size), .whole(size), "an empty bbox")
  }

  func testBoxIsOrdered() {
    XCTAssertEqual(AreaFrame(box: [500, 693, 100, 160])?.box, [100, 160, 500, 693])
    XCTAssertNil(AreaFrame(box: [1, 2, 3]))
  }

  // MARK: Drags

  func testCornerDragMovesTwoEdges() {
    let start = AreaFrame(x0: 100, y0: 100, x1: 500, y1: 600)
    assertBox(start.dragged(.bottomTrailing, dx: 200, dy: 100, in: size), [100, 100, 700, 700])
    assertBox(start.dragged(.topLeading, dx: -50, dy: 40, in: size), [50, 140, 500, 600])
  }

  func testEdgeDragMovesOneEdge() {
    let start = AreaFrame(x0: 100, y0: 100, x1: 500, y1: 600)
    assertBox(start.dragged(.trailing, dx: 100, dy: 999, in: size), [100, 100, 600, 600], accuracy: 0)
    assertBox(start.dragged(.top, dx: 999, dy: -50, in: size), [100, 50, 500, 600], accuracy: 0)
  }

  func testDragStopsAtThePhotoAndTheSmallestSize() {
    let start = AreaFrame(x0: 100, y0: 100, x1: 500, y1: 600)
    assertBox(start.dragged(.bottomTrailing, dx: 5000, dy: 5000, in: size), [100, 100, 1200, 1600])
    // The smallest side is 5 % of 1200 = 60 px.
    assertBox(start.dragged(.leading, dx: 1000, dy: 0, in: size), [440, 100, 500, 600])
    assertBox(start.dragged(.bottom, dx: 0, dy: -1000, in: size), [100, 100, 500, 160])
  }

  func testMoveKeepsTheSizeInsideThePhoto() {
    let start = AreaFrame(x0: 100, y0: 100, x1: 500, y1: 600)
    assertBox(start.dragged(.move, dx: 50, dy: 60, in: size), [150, 160, 550, 660])
    assertBox(start.dragged(.move, dx: -500, dy: 5000, in: size), [0, 1100, 400, 1600])
  }

  // MARK: VoiceOver actions

  func testGrowAndShrinkByTenPercentAroundTheCentre() {
    let start = AreaFrame(x0: 400, y0: 400, x1: 800, y1: 1200)
    assertBox(start.grown(in: size), [380, 360, 820, 1240])
    assertBox(start.shrunk(in: size), [420, 440, 780, 1160])
  }

  func testGrowSlidesAwayFromAnEdgeAndStopsAtThePhoto() {
    let atEdge = AreaFrame(x0: 0, y0: 0, x1: 400, y1: 400)
    assertBox(atEdge.grown(in: size), [0, 0, 440, 440])
    XCTAssertEqual(AreaFrame.whole(size).grown(in: size), .whole(size))
    let tiny = AreaFrame(x0: 0, y0: 0, x1: 60, y1: 60)
    XCTAssertEqual(tiny.shrunk(in: size).width, 60, accuracy: 0.001, "never smaller than 60 px")
  }

  func testMoveByTenPercentOfThePhoto() {
    let start = AreaFrame(x0: 400, y0: 400, x1: 800, y1: 800)
    assertBox(start.moved(.up, in: size), [400, 240, 800, 640])
    assertBox(start.moved(.down, in: size), [400, 560, 800, 960])
    assertBox(start.moved(.left, in: size), [280, 400, 680, 800])
    assertBox(start.moved(.right, in: size), [520, 400, 920, 800])
    assertBox(AreaFrame(x0: 50, y0: 0, x1: 450, y1: 400).moved(.left, in: size), [0, 0, 400, 400], accuracy: 0)
  }

  func testSizeIsSaidInPercentOfThePhoto() {
    XCTAssertTrue(AreaFrame(x0: 0, y0: 0, x1: 600, y1: 400).percent(of: size) == (50, 25))
    XCTAssertTrue(AreaFrame.whole(size).percent(of: ImageSize(w: 0, h: 0)) == (0, 0))
    XCTAssertTrue(AdjustAreaView.sizeText(AreaFrame(x0: 0, y0: 0, x1: 600, y1: 400), image: size).contains("50"))
  }

  // MARK: Handles

  func testHandlesUnderTheFinger() {
    let rect = CGRect(x: 100, y: 100, width: 200, height: 300)
    let t: CGFloat = 22
    XCTAssertEqual(AreaFrame.handle(at: CGPoint(x: 110, y: 90), rect: rect, tolerance: t), .topLeading)
    XCTAssertEqual(AreaFrame.handle(at: CGPoint(x: 305, y: 395), rect: rect, tolerance: t), .bottomTrailing)
    XCTAssertEqual(AreaFrame.handle(at: CGPoint(x: 200, y: 105), rect: rect, tolerance: t), .top)
    XCTAssertEqual(AreaFrame.handle(at: CGPoint(x: 290, y: 250), rect: rect, tolerance: t), .trailing)
    XCTAssertEqual(AreaFrame.handle(at: CGPoint(x: 200, y: 250), rect: rect, tolerance: t), .move)
    XCTAssertNil(AreaFrame.handle(at: CGPoint(x: 400, y: 250), rect: rect, tolerance: t), "outside: the screen scrolls")
  }

  func testNearerEdgeWinsOnANarrowFrame() {
    let rect = CGRect(x: 100, y: 100, width: 20, height: 20)
    XCTAssertEqual(AreaFrame.handle(at: CGPoint(x: 101, y: 101), rect: rect, tolerance: 22), .topLeading)
    XCTAssertEqual(AreaFrame.handle(at: CGPoint(x: 119, y: 119), rect: rect, tolerance: 22), .bottomTrailing)
  }

  /// Dragging in view points maps to image pixels with the photo screens' mapping.
  func testViewDragMapsToImagePixels() {
    let fit = CutoutGeometry.fitRect(image: size, in: CGSize(width: 300, height: 400))
    let start = AreaFrame.initial(piece: piece, image: size)
    let rect = CutoutGeometry.viewRect(box: start.box, shownIn: fit, image: size)
    XCTAssertEqual(rect?.minX ?? 0, 21, accuracy: 0.01)
    let dx = 25 * size.w / fit.width
    XCTAssertEqual(start.dragged(.trailing, dx: dx, dy: 0, in: size).x1, 616, accuracy: 0.01, "25 pt = 100 px")
  }
}
