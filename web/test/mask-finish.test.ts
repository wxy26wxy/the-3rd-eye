import { describe, expect, it } from "vitest";
import sharp from "sharp";
import type { Mask, Segment } from "@/lib/ai/types";
import { alphaToMask, area, emptyMask, erode, finishMask, iou, removePiecesAt, unionMasks } from "@/lib/image/mask";
import { dedupeSegments, objectBox, pickByHint } from "@/lib/ai/meta/sam";
import { removeBackground } from "@/lib/image/sticker";

/** Mask from a predicate over (x, y). */
function shape(w: number, h: number, inside: (x: number, y: number) => boolean): Mask {
  const m = emptyMask(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m.data[y * w + x] = inside(x, y) ? 1 : 0;
  return m;
}
const ring = (cx: number, cy: number, r0: number, r1: number) => (x: number, y: number) => {
  const d = Math.hypot(x - cx, y - cy);
  return d >= r0 && d <= r1;
};
const disc = (cx: number, cy: number, r: number) => (x: number, y: number) => Math.hypot(x - cx, y - cy) <= r;
const seg = (mask: Mask, score: number): Segment => {
  let x0 = mask.width, y0 = mask.height, x1 = 0, y1 = 0;
  for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) if (mask.data[y * mask.width + x]) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
  }
  return { mask, score, bbox: [x0, y0, x1, y1], svgPath: "" };
};

describe("finishMask", () => {
  it("fills a ring's hole and keeps a soft (anti-aliased) edge", async () => {
    const m = shape(200, 200, ring(100, 100, 30, 70));
    expect(m.data[100 * 200 + 100]).toBe(0); // the hole SAM left
    const out = await finishMask(m, { width: 400, height: 400 });
    expect(out.width).toBe(400);
    expect(out.alpha[200 * 400 + 200]).toBe(255); // hole filled
    expect(out.alpha[10 * 400 + 10]).toBe(0); // background stays clear
    const soft = Array.from(out.alpha).filter((v) => v > 0 && v < 255).length;
    expect(soft).toBeGreaterThan(500); // edge ramps through intermediate values
    // the outer edge stays where it was (radius 70 → 140 at 2×)
    expect(out.alpha[200 * 400 + 200 + 130]).toBe(255);
    expect(out.alpha[200 * 400 + 200 + 150]).toBe(0);
  });

  it("closes hairline gaps and drops specks under 0.5 % of the main blob", async () => {
    const m = shape(200, 200, (x, y) => (disc(100, 100, 60)(x, y) && Math.abs(x - 100) > 0) || (x === 5 && y === 5));
    const out = alphaToMask(await finishMask(m, { width: 200, height: 200 }));
    expect(out.data[100 * 200 + 100]).toBe(1); // 1-px seam closed
    expect(out.data[5 * 200 + 5]).toBe(0); // speck dropped
  });

  it("keeps a small real piece (a 30×30 dot next to a big disc) in one mask", async () => {
    const m = shape(1000, 800, (x, y) => disc(300, 400, 250)(x, y) || (x >= 800 && x < 830 && y >= 380 && y < 410));
    const out = alphaToMask(await finishMask(m, { width: 1000, height: 800 }));
    expect(out.data[395 * 1000 + 815]).toBe(1); // 900 px dot: under 0.5 % of the disc but above 0.02 % of the frame
  });

  it("removePiecesAt drops only the piece under a point", () => {
    const m = unionMasks([shape(200, 100, disc(50, 50, 30)), shape(200, 100, disc(150, 50, 30))]);
    const out = removePiecesAt(m, [{ x: 150, y: 50 }, { x: 100, y: 5 }]);
    expect(out.data[50 * 200 + 50]).toBe(1);
    expect(out.data[50 * 200 + 150]).toBe(0);
  });

  it("keeps every combined piece, even a small one", async () => {
    const big = shape(300, 200, disc(80, 100, 60));
    const small = shape(300, 200, disc(250, 100, 3)); // ~0.3 % of the big disc
    const alone = alphaToMask(await finishMask(unionMasks([big, small]), { width: 300, height: 200 }));
    expect(alone.data[100 * 300 + 250]).toBe(0); // as one mask, the speck is dropped
    const combined = alphaToMask(await finishMask([big, small], { width: 300, height: 200 }));
    expect(combined.data[100 * 300 + 250]).toBe(1); // as a chosen part, it is kept
    expect(combined.data[100 * 300 + 80]).toBe(1);
  });

  it("removeBackground uses the soft alpha as the PNG's alpha channel", async () => {
    const img = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#3366cc" } }).png().toBuffer();
    const alpha = await finishMask(shape(200, 200, disc(100, 100, 50)), { width: 200, height: 200 });
    const out = await removeBackground(img, alpha);
    const { data, info } = await sharp(out.png).extractChannel(3).raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBeGreaterThanOrEqual(100);
    const values = new Set(Array.from(data));
    expect([...values].some((v) => v > 0 && v < 255)).toBe(true);
    expect(area(out.mask)).toBeGreaterThan(7000);
  });

  it("erode shrinks a disc", async () => {
    const m = shape(100, 100, disc(50, 50, 30));
    expect(area(await erode(m, 4))).toBeLessThan(area(m));
  });
});

describe("dedupeSegments (two SAM phrases)", () => {
  it("drops a near-duplicate (IoU > 0.8) and keeps the higher score", () => {
    const a = seg(shape(200, 200, disc(60, 100, 40)), 0.9);
    const a2 = seg(shape(200, 200, disc(61, 100, 40)), 0.7);
    const b = seg(shape(200, 200, disc(150, 100, 30)), 0.8);
    expect(iou(a.mask, a2.mask)).toBeGreaterThan(0.8);
    const out = dedupeSegments([a2, b, a]);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(a);
    expect(out[1]).toBe(b);
  });

  it("keeps overlapping but distinct parts, drops the frame-filling paper, caps the count", () => {
    const body = seg(shape(200, 200, disc(100, 100, 50)), 0.9);
    const head = seg(shape(200, 200, disc(100, 60, 25)), 0.85); // inside the body: IoU ≈ 0.25
    const paper = seg(shape(200, 200, () => true), 0.99);
    const out = dedupeSegments([body, head, paper]);
    expect(out).toEqual([body, head]);
    const many = Array.from({ length: 9 }, (_, i) => seg(shape(400, 40, disc(20 + i * 44, 20, 15)), 0.5 + i / 100));
    expect(dedupeSegments(many)).toHaveLength(6);
  });

  it("drops a container (the paper around a drawing) covering > 40 % of the frame", () => {
    const paper = seg(shape(200, 200, (x, y) => x >= 20 && x < 180 && y >= 20 && y < 180), 0.6); // 64 % of the frame
    const drawing = seg(shape(200, 200, disc(100, 100, 30)), 0.5);
    expect(dedupeSegments([paper, drawing])).toEqual([drawing]);
    const bigToy = seg(shape(200, 200, disc(100, 100, 75)), 0.9); // 44 %, contains nothing → kept
    const other = seg(shape(200, 200, disc(190, 190, 8)), 0.5);
    expect(dedupeSegments([bigToy, other])).toEqual([bigToy, other]);
  });
});

describe("SAM hint helpers", () => {
  it("an edge-reaching box keeps the last column and row", () => {
    expect(objectBox([0, 0, 320, 256], 1, 1, 320, 256)).toEqual({ left: 0, top: 0, right: 320, bottom: 256 });
    expect(objectBox([10.5, 10.5, 10.6, 10.6], 1, 1, 320, 256)).toEqual({ left: 10, top: 10, right: 11, bottom: 11 });
  });
  it("pickByHint returns nothing when positive taps hit no fallback piece and there is no box", () => {
    const a = seg(shape(100, 100, disc(30, 30, 10)), 0.9);
    expect(pickByHint([a], { points: [{ x: 80, y: 80 }] })).toBeNull();
    expect(pickByHint([a], { points: [{ x: 30, y: 30 }] })).toBe(a);
  });
});
