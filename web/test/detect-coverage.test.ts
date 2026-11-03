/** T134 fix round (I2): inside a tight frame the piece may fill the crop or hold its own higher-scoring part; detect keeps both. */
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import type { Mask, Segment } from "@/lib/ai/types";
import { emptyMask } from "@/lib/image/mask";
import { MetaSegmenter, dedupeSegmentsInfo } from "@/lib/ai/meta/sam";
import { pngRef } from "@/lib/image/ref";

const W = 200, H = 160;
function rect(x0: number, y0: number, x1: number, y1: number): Mask {
  const m = emptyMask(W, H);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m.data[y * W + x] = 1;
  return m;
}
const seg = (m: Mask, bbox: [number, number, number, number], score: number): Segment => ({ mask: m, bbox, score, svgPath: "" });
const DETECT = { maxCoverage: 1, dropContainers: false };

describe("dedupeSegmentsInfo with the detect rules", () => {
  it("a frame-filling piece is dropped by default (background) but kept with maxCoverage 1", () => {
    const full = seg(rect(0, 0, W, H), [0, 0, W, H], 0.9);
    expect(dedupeSegmentsInfo([full]).segments).toHaveLength(0);
    expect(dedupeSegmentsInfo([full], DETECT).segments).toEqual([full]);
  });

  it("a piece over 40 % of the frame holding a higher-scoring sub-part: both survive with dropContainers false", () => {
    const big = seg(rect(10, 10, 190, 150), [10, 10, 190, 150], 0.6); // ≈ 79 % of the frame
    const part = seg(rect(60, 50, 110, 100), [60, 50, 110, 100], 0.9);
    const byDefault = dedupeSegmentsInfo([big, part]);
    expect(byDefault.segments).toEqual([part]);
    expect(byDefault.droppedContainer).toBe(true);
    const detect = dedupeSegmentsInfo([big, part], DETECT);
    expect(detect.segments).toEqual([part, big]);
    expect(detect.droppedContainer).toBe(false);
  });
});

describe("MetaSegmenter.findCandidates passes the rules through (threshold fallback, no network)", () => {
  async function* empty() { yield { type: "response.completed" }; }
  it("a crop the art fills edge to edge gives a candidate with the detect rules and none by default", async () => {
    const crop = await sharp({ create: { width: W, height: H, channels: 3, background: "#203040" } }).png().toBuffer();
    const sam = new MetaSegmenter(async () => empty());
    const trace = { stage: "segment" };
    expect((await sam.findCandidates(pngRef(crop), { trace })).segments).toHaveLength(0);
    const found = await sam.findCandidates(pngRef(crop), { trace, ...DETECT });
    expect(found.segments).toHaveLength(1);
    expect(found.segments[0].bbox).toEqual([0, 0, W, H]);
  });
});
