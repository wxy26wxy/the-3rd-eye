import { describe, expect, it, vi } from "vitest";
import { MetaSegmenter, preferFallbackOverFill } from "@/lib/ai/meta/sam";
import { emptyMask, bboxOf } from "@/lib/image/mask";
import { pngRef } from "@/lib/image/ref";
import type { Mask, Segment } from "@/lib/ai/types";

const W = 20, H = 20;
function seg(x0: number, y0: number, x1: number, y1: number, score = 0.7): Segment {
  const mask: Mask = emptyMask(W, H);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask.data[y * W + x] = 1;
  return { mask, bbox: bboxOf(mask)!, score, svgPath: "" };
}
const full = () => seg(0, 0, W, H);
const piece = (i: number) => seg(i * 6, 2, i * 6 + 4, 8);
const fill = { segments: [full()], droppedContainer: false };

describe("preferFallbackOverFill (T153)", () => {
  it("a full-frame mask and 3 fallback pieces gives the 3 pieces", () => {
    const r = preferFallbackOverFill(fill, [piece(0), piece(1), piece(2)]);
    expect(r.segments).toHaveLength(3);
    expect(r.droppedContainer).toBe(true);
  });
  it("caps at max, largest first", () => {
    const r = preferFallbackOverFill(fill, [piece(0), seg(0, 10, 10, 20), piece(2)], { max: 2 });
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0].bbox).toEqual([0, 10, 10, 20]);
  });
  it("keeps the SAM mask with 1 or 0 fallback pieces", () => {
    expect(preferFallbackOverFill(fill, [piece(0)])).toBe(fill);
    expect(preferFallbackOverFill(fill, [])).toBe(fill);
    expect(preferFallbackOverFill(fill, [full(), piece(0)])).toBe(fill);
  });
  it("leaves real pieces alone", () => {
    const real = { segments: [piece(0), piece(1)], droppedContainer: false };
    expect(preferFallbackOverFill(real, [piece(0), piece(1), piece(2)])).toBe(real);
  });
});

async function png() {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width: W, height: H, channels: 3, background: "#fff" } }).png().toBuffer();
}
function segmenter(sam: Segment[], fb: Segment[]) {
  const s = new MetaSegmenter(async () => { throw new Error("unused"); });
  const priv = s as unknown as { run: unknown; fallback: unknown };
  priv.run = vi.fn(async () => sam);
  const fallback = vi.fn(async () => fb);
  priv.fallback = fallback;
  return { s, fallback };
}
const opts = { trace: { stage: "segment" } as never, maxCoverage: 1, dropContainers: false, max: 6 };

describe("MetaSegmenter.findCandidates frame-filling answer (T153)", () => {
  it("uses the fallback pieces when SAM answers the whole sheet", async () => {
    const { s } = segmenter([full()], [piece(0), piece(1), piece(2)]);
    const r = await s.findCandidates(pngRef(await png()), opts);
    expect(r.segments).toHaveLength(3);
  });
  it("keeps the SAM mask when the fallback finds one piece", async () => {
    const { s } = segmenter([full()], [piece(0)]);
    const r = await s.findCandidates(pngRef(await png()), opts);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].bbox).toEqual([0, 0, W, H]);
  });
  it("does not call the fallback when SAM found real pieces", async () => {
    const { s, fallback } = segmenter([piece(0), piece(1)], [piece(2)]);
    const r = await s.findCandidates(pngRef(await png()), opts);
    expect(r.segments).toHaveLength(2);
    expect(fallback).not.toHaveBeenCalled();
  });
});
