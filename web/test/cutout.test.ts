import { describe, expect, it } from "vitest";
import {
  boxAround, centrePoint, chooseAction, fitRect, imageBox, imagePoint, leavesNothing, makeRequest,
  percentRect, productNotice, sameRequest, type CutoutPoint,
} from "@/components/create/cutout";

const IMG = { w: 1200, h: 1600 };

describe("fitRect (aspect-fit, letterboxing)", () => {
  it("fills a container of the same aspect ratio", () => {
    expect(fitRect(IMG, { width: 300, height: 400 })).toEqual({ x: 0, y: 0, width: 300, height: 400 });
  });
  it("letterboxes left and right in a container that is too wide", () => {
    expect(fitRect(IMG, { width: 600, height: 400 })).toEqual({ x: 150, y: 0, width: 300, height: 400 });
  });
  it("letterboxes top and bottom in a container that is too tall", () => {
    expect(fitRect({ w: 1600, h: 1200 }, { width: 400, height: 600 })).toEqual({ x: 0, y: 150, width: 400, height: 300 });
  });
  it("is empty for a zero size", () => {
    expect(fitRect({ w: 0, h: 10 }, { width: 400, height: 600 }).width).toBe(0);
    expect(fitRect(IMG, { width: 0, height: 600 }).width).toBe(0);
  });
});

describe("imagePoint", () => {
  const frame = fitRect(IMG, { width: 600, height: 400 }); // x 150..450
  it("maps the centre of the shown image to the centre of the original", () => {
    expect(imagePoint({ x: 300, y: 200 }, frame, IMG)).toEqual({ x: 600, y: 800 });
  });
  it("subtracts the letterbox offset", () => {
    expect(imagePoint({ x: 150, y: 0 }, frame, IMG)).toEqual({ x: 0, y: 0 });
    expect(imagePoint({ x: 450, y: 400 }, frame, IMG)).toEqual({ x: 1200, y: 1600 });
  });
  it("ignores taps in the letterbox, or clamps them when asked", () => {
    expect(imagePoint({ x: 100, y: 200 }, frame, IMG)).toBeNull();
    expect(imagePoint({ x: 100, y: 200 }, frame, IMG, true)).toEqual({ x: 0, y: 800 });
    expect(imagePoint({ x: 500, y: 450 }, frame, IMG, true)).toEqual({ x: 1200, y: 1600 });
  });
});

describe("imageBox", () => {
  const frame = fitRect(IMG, { width: 300, height: 400 });
  it("orders the corners whichever way the drag went", () => {
    expect(imageBox({ x: 225, y: 300 }, { x: 75, y: 100 }, frame, IMG)).toEqual([300, 400, 900, 1200]);
  });
  it("clamps to the image and drops empty boxes", () => {
    expect(imageBox({ x: -50, y: -50 }, { x: 150, y: 200 }, frame, IMG)).toEqual([0, 0, 600, 800]);
    expect(imageBox({ x: 10, y: 10 }, { x: 10, y: 300 }, frame, IMG)).toBeNull();
  });
});

describe("percentRect", () => {
  it("expresses a bbox as percentages of the image", () => {
    expect(percentRect([120, 160, 600, 800], IMG)).toEqual({ left: 10, top: 10, width: 40, height: 40 });
    expect(percentRect([1, 2, 3], IMG)).toBeNull();
  });
});

const A = { id: "a", bbox: [0, 0, 500, 500] };
const B = { id: "b", bbox: [600, 600, 1100, 1500] };
const pos = (x: number, y: number): CutoutPoint => ({ x, y, label: "positive" });
const neg = (x: number, y: number): CutoutPoint => ({ x, y, label: "negative" });

describe("makeRequest / chooseAction", () => {
  it("sends nothing when nothing is chosen", () => {
    expect(makeRequest([], [], null)).toBeNull();
    expect(chooseAction([], [], null)).toBeNull();
  });
  it("uses select for one piece and no marks", () => {
    expect(chooseAction(["a"], [], null)).toEqual({ kind: "select", candidateId: "a" });
  });
  it("combines several pieces with cleanup", () => {
    expect(chooseAction(["a", "b"], [], null)).toEqual({ kind: "cleanup", body: { candidateIds: ["a", "b"] } });
  });
  it("always sends the chosen pieces with marks and the box", () => {
    expect(makeRequest(["a"], [neg(10, 10), pos(700, 700)], [1, 2, 3, 4])).toEqual({
      candidateIds: ["a"], points: [neg(10, 10), pos(700, 700)], box: [1, 2, 3, 4],
    });
    expect(chooseAction(["a"], [pos(1, 1)], null)?.kind).toBe("cleanup");
  });
  it("refuses Remove-area marks with no piece and no box", () => {
    expect(makeRequest([], [neg(10, 10)], null)).toBeNull();
    expect(makeRequest([], [neg(10, 10)], [0, 0, 5, 5])).toEqual({ points: [neg(10, 10)], box: [0, 0, 5, 5] });
    expect(makeRequest([], [pos(10, 10)], null)).toEqual({ points: [pos(10, 10)] });
  });
  it("caps points at 10", () => {
    const many = Array.from({ length: 12 }, (_, i) => pos(i, i));
    expect(makeRequest([], many, null)?.points).toHaveLength(10);
  });
  it("compares requests by value", () => {
    expect(sameRequest(makeRequest(["a"], [pos(1, 2)], null), makeRequest(["a"], [pos(1, 2)], null))).toBe(true);
    expect(sameRequest(makeRequest(["a"], [], null), makeRequest(["a", "b"], [], null))).toBe(false);
  });
});

describe("leavesNothing", () => {
  it("is true when a Remove-area mark lands on the only chosen piece", () => {
    expect(leavesNothing([A], [neg(100, 100)], null)).toBe(true);
  });
  it("is false when another piece, a box or an Add-area mark is left", () => {
    expect(leavesNothing([A, B], [neg(100, 100)], null)).toBe(false);
    expect(leavesNothing([A], [neg(100, 100)], [0, 0, 10, 10])).toBe(false);
    expect(leavesNothing([A], [neg(100, 100), pos(700, 700)], null)).toBe(false);
    expect(leavesNothing([A], [neg(900, 900)], null)).toBe(false);
  });
  it("is true when every chosen piece is marked out", () => {
    expect(leavesNothing([A, B], [neg(100, 100), neg(700, 700)], null)).toBe(true);
  });
});

describe("piece actions", () => {
  it("box around a piece is its bbox; add-area is its centre", () => {
    expect(boxAround(B)).toEqual([600, 600, 1100, 1500]);
    expect(centrePoint(B)).toEqual({ x: 850, y: 1050, label: "positive" });
    expect(boxAround({ id: "x", bbox: [5, 5, 5, 9] })).toBeNull();
  });
});

describe("productNotice", () => {
  const copy = { failed: "F.", unpublished: "U." };
  it("says nothing when products are fine", () => {
    expect(productNotice({ failedProductIds: [], unpublishedProductIds: [] }, copy)).toBeNull();
    expect(productNotice(undefined, copy)).toBeNull();
  });
  it("one line per kind of trouble", () => {
    expect(productNotice({ failedProductIds: ["p"], unpublishedProductIds: [] }, copy)).toBe("F.");
    expect(productNotice({ failedProductIds: ["p"], unpublishedProductIds: ["q"] }, copy)).toBe("F. U.");
  });
});
