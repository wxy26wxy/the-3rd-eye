import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { BLEED_MM, BORDER_MM, composeSticker, ensureDpi, mmToPx, normalizePath, offsetMask, previewCutPath, removeBackground, traceOutline } from "@/lib/ai/meta/sticker";
import { bboxOf, emptyMask, maskFromAlpha, padMask } from "@/lib/image/mask";
import type { Mask } from "@/lib/ai/types";

function disc(width: number, height: number, cx: number, cy: number, r: number, into?: Mask): Mask {
  const m = into ?? emptyMask(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) m.data[y * width + x] = 1;
  return m;
}

/** An RGBA artwork: two separate blobs close together, transparent elsewhere. */
async function twoBlobArt(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000">
    <circle cx="380" cy="500" r="200" fill="#3bb273" stroke="#000" stroke-width="20"/>
    <circle cx="680" cy="500" r="90" fill="#e15554" stroke="#000" stroke-width="20"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe("sticker pipeline", () => {
  it("offsetMask (dilation) grows the bounding box by about the requested radius", async () => {
    const mask = padMask(disc(200, 200, 100, 100, 40), 60);
    const before = bboxOf(mask)!;
    const grown = bboxOf(await offsetMask(mask, 20))!;
    expect(grown[0]).toBeLessThan(before[0]);
    expect(grown[1]).toBeLessThan(before[1]);
    expect(grown[2]).toBeGreaterThan(before[2]);
    expect(grown[3]).toBeGreaterThan(before[3]);
    const growth = before[0] - grown[0];
    expect(growth).toBeGreaterThanOrEqual(12);
    expect(growth).toBeLessThanOrEqual(28);
  });

  it("composeSticker yields a single die-cut contour, a non-empty SVG and a 300 dpi PNG", async () => {
    const files = await composeSticker(await twoBlobArt());
    const moves = files.cutPath.match(/M/g) ?? [];
    expect(moves).toHaveLength(1);
    expect(files.dieCutSvg).toContain("<svg");
    expect(files.dieCutSvg).toMatch(/<path id="die-cut" d="M[^"]+"/);
    expect(files.dieCutSvg).toContain(`${files.widthMm}mm`);
    const meta = await sharp(files.printPng).metadata();
    expect(meta.density).toBe(300);
    expect(meta.hasAlpha).toBe(true);
    const pad = mmToPx(BORDER_MM) + mmToPx(BLEED_MM) + 4;
    expect(meta.width).toBe(1000 + 2 * pad);
  });

  it("print PNG has a white border around the art and is transparent far outside", async () => {
    const files = await composeSticker(await twoBlobArt());
    const { data, info } = await sharp(files.printPng).raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4));
    expect(px(0, 0)[3]).toBe(0);
    const pad = mmToPx(BORDER_MM) + mmToPx(BLEED_MM) + 4;
    // Just left of the big circle's outline (x = 180 - 10 in art coords) lies inside the border: opaque white.
    expect(px(pad + 180 - 10 - 15, pad + 500)).toEqual([255, 255, 255, 255]);
  });

  it("traceOutline returns an SVG path for a mask", async () => {
    const d = await traceOutline(padMask(disc(100, 100, 50, 50, 30), 10));
    expect(d.startsWith("M")).toBe(true);
  });

  it("ensureDpi doubles small images with Lanczos and leaves large ones alone", async () => {
    const small = await sharp({ create: { width: 400, height: 600, channels: 3, background: "#fff" } }).png().toBuffer();
    const up = await sharp(await ensureDpi(small)).metadata();
    expect([up.width, up.height]).toEqual([800, 1200]);
    const big = await sharp({ create: { width: 1000, height: 900, channels: 3, background: "#fff" } }).png().toBuffer();
    expect(await ensureDpi(big)).toBe(big);
  });

  it("removeBackground applies the mask as alpha and trims to it", async () => {
    const img = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#f2c14e" } }).png().toBuffer();
    const mask = disc(300, 200, 150, 100, 50);
    const out = await removeBackground(img, mask);
    expect(out.bbox).toEqual([100, 50, 201, 151]);
    const meta = await sharp(out.png).metadata();
    expect([meta.width, meta.height]).toEqual([101, 101]);
    const alpha = await maskFromAlpha(out.png);
    expect(alpha.data[0]).toBe(0);
    expect(alpha.data[50 * 101 + 50]).toBe(1);
  });

  it("normalizes preview cut paths into a 0 0 100 100 viewBox (contain, centered)", async () => {
    expect(normalizePath("M10 0 L210 100", 200, 100, 10)).toBe("M0 20 L100 70");
    const d = await previewCutPath(await twoBlobArt());
    const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    expect(nums.length).toBeGreaterThan(4);
    expect(Math.min(...nums)).toBeGreaterThan(-10);
    expect(Math.max(...nums)).toBeLessThan(110);
  });
});
