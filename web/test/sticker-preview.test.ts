import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PREVIEW_MAX_PX, composeSticker } from "@/lib/image/sticker";

/** A dark disc on a transparent w × h canvas. */
async function disc(w: number, h: number) {
  const r = Math.min(w, h) / 2 - 4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="#203040"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** A dark rectangle filling a transparent w × h canvas (4 px margin). */
async function rect(w: number, h: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="4" y="4" width="${w - 8}" height="${h - 8}" fill="#203040"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function rgba(png: Buffer) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => { const i = (y * info.width + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
  return { info, px };
}

describe("sticker preview (T121)", () => {
  it("is at most 1200 px on the longer side, has alpha, transparent corners, and a white border around the art", async () => {
    const files = await composeSticker(await rect(2400, 1600));
    const meta = await sharp(files.previewPng).metadata();
    expect(meta.format).toBe("png");
    expect(meta.hasAlpha).toBe(true);
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(PREVIEW_MAX_PX);
    expect(Math.max(meta.width!, meta.height!)).toBe(PREVIEW_MAX_PX);
    // Proportions follow the print file (no skew).
    const print = await sharp(files.printPng).metadata();
    expect(meta.width! / meta.height!).toBeCloseTo(print.width! / print.height!, 1);

    const { info, px } = await rgba(files.previewPng);
    const cy = Math.round(info.height / 2), cx = Math.round(info.width / 2);
    expect(px(0, 0)[3]).toBe(0); // transparent outside the border
    expect(px(cx, cy).slice(0, 3)).toEqual([0x20, 0x30, 0x40]); // the art
    // Walking in from the left edge along the middle row: transparent → white border → art.
    let x = 0;
    while (x < cx && px(x, cy)[3] < 250) x++;
    const borderStart = x;
    while (x < cx && px(x, cy)[0] > 240 && px(x, cy)[1] > 240) x++;
    expect(x - borderStart).toBeGreaterThanOrEqual(3); // a visible white band
    expect(px(x + 4, cy)[0]).toBeLessThan(100); // then the dark art
  });

  it("leaves the bleed off: the preview is not wider than the print file's border (relative to the art)", async () => {
    const files = await composeSticker(await disc(1000, 1000));
    const [p, pr] = await Promise.all([sharp(files.previewPng).metadata(), sharp(files.printPng).metadata()]);
    expect(p.width!).toBeLessThan(pr.width!); // trimmed to the cut line, print keeps bleed + padding
  });

});
