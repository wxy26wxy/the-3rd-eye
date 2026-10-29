/**
 * Sticker print pipeline (pure image math, no model calls):
 * mask → offsetMask (~3 mm white border at 300 dpi) → single outer contour → potrace
 * outline → print PNG (white border + 1.5 mm bleed, 300 dpi metadata) + die-cut SVG.
 */
import "server-only";
import sharp from "sharp";
import { Potrace } from "potrace";
import type { Mask } from "../types";
import {
  bboxOf, componentMask, components, cropMask, dilate, fillHoles, maskFromAlpha, maskSharp, maskToGrey, padMask, type BBox,
} from "@/lib/image/mask";

export const PRINT_DPI = 300;
export const BORDER_MM = 3;
export const BLEED_MM = 1.5;
export const MIN_SHORT_SIDE = 900;

export const mmToPx = (mm: number, dpi = PRINT_DPI) => Math.round((mm / 25.4) * dpi);

/** Grows the mask by `px` (blur + threshold) and fills holes, so the result is a solid silhouette. */
export async function offsetMask(mask: Mask, px: number): Promise<Mask> {
  return fillHoles(await dilate(mask, px));
}

/** Ensures one connected outline: dilate further until pieces merge (≤ 4 tries), then keep the largest. */
export async function singleContour(mask: Mask, step: number): Promise<Mask> {
  let current = mask;
  for (let i = 0; i < 4; i++) {
    const { parts } = components(current);
    if (parts.length <= 1) return current;
    current = await offsetMask(current, step * (i + 1));
  }
  const { labels, parts } = components(current);
  if (parts.length <= 1) return current;
  const largest = parts.reduce((a, b) => (b.area > a.area ? b : a));
  return fillHoles(componentMask(current, labels, largest.label));
}

/** Potrace outline of the mask as an SVG path `d` string (pixel coordinates). */
export async function traceOutline(mask: Mask): Promise<string> {
  const png = await maskSharp(mask).negate().png().toBuffer(); // black shape on white
  const tracer = new Potrace({ turdSize: 50, optTolerance: 0.4, threshold: 128, blackOnWhite: true });
  await new Promise<void>((resolve, reject) => tracer.loadImage(png, (err) => (err ? reject(err) : resolve())));
  const tag = tracer.getPathTag("#000");
  return /\sd="([^"]*)"/.exec(tag)?.[1]?.trim() ?? "";
}

/** Lanczos ×2 upscale when the short side is below 900 px (3 in at 300 dpi). */
export async function ensureDpi(png: Buffer, minShortSide = MIN_SHORT_SIDE): Promise<Buffer> {
  const meta = await sharp(png).metadata();
  const w = meta.width ?? 0, h = meta.height ?? 0;
  if (Math.min(w, h) >= minShortSide || !w || !h) return png;
  return sharp(png).resize(w * 2, h * 2, { kernel: "lanczos3" }).png().toBuffer();
}

/** Applies the mask as alpha and trims to the mask's bounding box. */
export async function removeBackground(png: Buffer, mask: Mask): Promise<{ png: Buffer; mask: Mask; bbox: BBox }> {
  const bbox = bboxOf(mask);
  if (!bbox) throw new Error("Mask is empty");
  // removeAlpha is applied at output time by sharp, so materialize RGB first, then join the mask as alpha.
  const rgb = await sharp(png).rotate().resize(mask.width, mask.height, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const alpha = maskToGrey(mask);
  const [x0, y0, x1, y1] = bbox;
  const withAlpha = await sharp(rgb, { raw: { width: mask.width, height: mask.height, channels: 3 } })
    .joinChannel(alpha, { raw: { width: mask.width, height: mask.height, channels: 1 } }).png().toBuffer();
  const cut = await sharp(withAlpha).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).png().toBuffer();
  return { png: cut, mask: cropMask(mask, bbox), bbox };
}

export type StickerFiles = {
  printPng: Buffer; dieCutSvg: string; cutPath: string;
  widthPx: number; heightPx: number; widthMm: number; heightMm: number;
};

/** Builds the print PNG (art over white border + bleed, transparent outside) and the die-cut SVG. */
export async function composeSticker(artPng: Buffer, opts: { borderMm?: number; bleedMm?: number } = {}): Promise<StickerFiles> {
  const art = await ensureDpi(artPng);
  const mask = await maskFromAlpha(art);
  if (!bboxOf(mask)) throw new Error("Artwork has no visible pixels");
  const borderPx = mmToPx(opts.borderMm ?? BORDER_MM);
  const bleedPx = mmToPx(opts.bleedMm ?? BLEED_MM);
  const pad = borderPx + bleedPx + 4;

  const padded = padMask(mask, pad);
  const cut = await singleContour(await offsetMask(padded, borderPx), Math.max(4, Math.round(borderPx / 2)));
  const bleed = await dilate(cut, bleedPx);
  const { width, height } = cut;

  const white = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (bleed.data[i]) white.writeUInt32BE(0xffffffff, i * 4);
  }
  const artPadded = await sharp(art).ensureAlpha()
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const printPng = await sharp(white, { raw: { width, height, channels: 4 } })
    .composite([{ input: artPadded, left: 0, top: 0 }])
    .withMetadata({ density: PRINT_DPI })
    .png()
    .toBuffer();

  const cutPath = await traceOutline(cut);
  const widthMm = Math.round((width / PRINT_DPI) * 25.4 * 100) / 100;
  const heightMm = Math.round((height / PRINT_DPI) * 25.4 * 100) / 100;
  const dieCutSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${width} ${height}">` +
    `<path id="die-cut" d="${cutPath}" fill="none" stroke="#ff00ff" stroke-width="2"/></svg>`;
  return { printPng, dieCutSvg, cutPath, widthPx: width, heightPx: height, widthMm, heightMm };
}

/**
 * The cut-line path for an artwork preview (border offset only, no bleed), normalized to a
 * `0 0 100 100` viewBox: the cleaned image is fitted (contain, centered) into that square. The
 * border can extend a few units past 0–100, so render the SVG with overflow visible.
 */
export async function previewCutPath(cleanedPng: Buffer): Promise<string> {
  const mask = await maskFromAlpha(cleanedPng);
  const borderPx = Math.max(4, Math.round(Math.min(mask.width, mask.height) * 0.03));
  const pad = borderPx + 2;
  const cut = await singleContour(await offsetMask(padMask(mask, pad), borderPx), borderPx);
  return normalizePath(await traceOutline(cut), mask.width, mask.height, pad);
}

/** Pixel path (in a canvas padded by `pad`) → 0–100 square, image fitted with contain. */
export function normalizePath(d: string, width: number, height: number, pad = 0): string {
  const side = Math.max(width, height);
  const s = 100 / side;
  const ox = (side - width) / 2 - pad, oy = (side - height) / 2 - pad;
  let i = 0;
  return d.replace(/-?\d+(\.\d+)?/g, (n) => {
    const v = Number(n) + (i++ % 2 === 0 ? ox : oy);
    return String(Math.round(v * s * 100) / 100);
  });
}
