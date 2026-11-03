/** T134 ruling 4: anti-aliased cutout edges (no terraces), soft sticker border alpha. Offline fixtures. */
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import type { Mask } from "@/lib/ai/types";
import { emptyMask, finishMask, resizeMask, type AlphaMask } from "@/lib/image/mask";
import { composeSticker } from "@/lib/image/sticker";

/** A working-scale mask whose top edge is a 1:2 staircase (the edge rises 1 px every 2 px), filled below. */
function staircase(w: number, h: number): Mask {
  const m = emptyMask(w, h);
  for (let x = 0; x < w; x++) for (let y = 40 + Math.floor(x / 2); y < h - 20; y++) m.data[y * w + x] = 1;
  return m;
}

/** Sub-pixel row where the top edge of column x crosses alpha 128 (linear between the two rows around it). */
const edgeAt = (a: AlphaMask, x: number) => {
  for (let y = 1; y < a.height; y++) {
    const lo = a.alpha[(y - 1) * a.width + x], hi = a.alpha[y * a.width + x];
    if (hi >= 128 && lo < 128) return y - 1 + (128 - lo) / (hi - lo);
  }
  return -1;
};
/** First row with alpha ≥ 128 in column x, scanning down from y0. */
const boundary = (a: AlphaMask, x: number, y0 = 0) => { for (let y = y0; y < a.height; y++) if (a.alpha[y * a.width + x] >= 128) return y; return -1; };

describe("finishMask edge (alpha ramp)", () => {
  const W = 240, H = 200, K = 4;
  it("every edge column has an intermediate alpha and the edge has no terraces (no run of ≥ 3 identical steps) at ×4", async () => {
    const a = await finishMask(staircase(W, H), { width: W * K, height: H * K });
    // middle columns, away from the left/right ends of the shape
    const xs = Array.from({ length: (W - 80) * K }, (_, i) => 40 * K + i);
    for (const x of xs) {
      const b = boundary(a, x);
      expect(b).toBeGreaterThan(0);
      const ramp = [b - 2, b - 1, b, b + 1].map((y) => a.alpha[y * a.width + x]);
      expect(ramp.some((v) => v > 0 && v < 255)).toBe(true);
    }
    // Terraces: the edge stays put for several columns, then jumps. The shape rises 0.5 px per target column, so
    // a column-to-column step under 0.1 px is a flat step; no run of 3 or more flat steps is allowed.
    let run = 0, longest = 0;
    for (let i = 1; i < xs.length; i++) {
      const step = edgeAt(a, xs[i]) - edgeAt(a, xs[i - 1]);
      run = Math.abs(step) < 0.1 ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    expect(longest).toBeLessThan(3);
  });

  it("the anti-aliased band is narrow (1–2 px of intermediate alpha per column), inside 255, outside 0", async () => {
    const a = await finishMask(staircase(W, H), { width: W * K, height: H * K });
    const x = 120 * K;
    let soft = 0;
    for (let y = 0; y < a.height; y++) { const v = a.alpha[y * a.width + x]; if (v > 0 && v < 255) soft++; }
    expect(soft).toBeGreaterThanOrEqual(1);
    expect(soft).toBeLessThanOrEqual(4); // the top edge plus the bottom edge, 1–2 px each
    expect(a.alpha[(150 * K) * a.width + x]).toBe(255);
    expect(a.alpha[5 * a.width + x]).toBe(0);
  });
});

describe("resizeMask (linear, thresholded)", () => {
  it("upscaling a diagonal staircase does not produce blocks of the scale factor", async () => {
    const m = emptyMask(50, 50);
    for (let y = 0; y < 50; y++) for (let x = 0; x <= y; x++) m.data[y * 50 + x] = 1;
    const big = await resizeMask(m, 400, 400);
    // nearest-neighbour would hold each boundary column for 8 rows; linear + threshold steps every row or two
    let longest = 1, run = 1, prev = -1;
    for (let y = 40; y < 360; y++) {
      let b = 0; while (b < 400 && big.data[y * 400 + b]) b++;
      run = b === prev ? run + 1 : 1; prev = b; longest = Math.max(longest, run);
    }
    expect(longest).toBeLessThan(8);
  });
});

describe("composeSticker soft border alpha", () => {
  it("the preview and the print file have a soft (anti-aliased) outer border, opaque inside", async () => {
    const art = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800"><circle cx="500" cy="400" r="330" fill="#3060d0"/></svg>`)).png().toBuffer();
    const out = await composeSticker(art);
    for (const png of [out.previewPng, out.printPng]) {
      const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
      // scan the middle row from the left: transparent → a soft band → opaque white border
      const y = Math.floor(info.height / 2);
      let first = 0; while (first < info.width && alphaAt(first, y) === 0) first++;
      let full = first; while (full < info.width && alphaAt(full, y) < 255) full++;
      expect(full - first).toBeGreaterThanOrEqual(1); // at least one intermediate alpha
      expect(full - first).toBeLessThanOrEqual(6);
      expect(alphaAt(Math.floor(info.width / 2), y)).toBe(255);
      // the border at the band is white
      const o = (y * info.width + full) * info.channels;
      expect([data[o], data[o + 1], data[o + 2]]).toEqual([255, 255, 255]);
    }
  });
});
