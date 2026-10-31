/**
 * Sticker print pipeline (pure image math, no model calls):
 * mask → offsetMask (~3 mm white border at 300 dpi, holes filled) → potrace outline with one
 * outer contour per island (pieces that touch after the offset share one) → print PNG (white
 * border + 1.5 mm bleed, 300 dpi metadata) + die-cut SVG.
 */
import "server-only";
import sharp from "sharp";
import { Potrace } from "potrace";
import type { Mask } from "@/lib/ai/types";
import {
  alphaToMask, bboxOf, cropMask, dilate, fillHoles, maskFromAlpha, maskSharp, maskToGrey, padMask,
  type AlphaMask, type BBox,
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

/**
 * Potrace outline of the mask as an SVG path `d` string (pixel coordinates). Every connected
 * piece becomes its own `M…Z` subpath of the one `d`; pass a hole-filled mask (offsetMask) so
 * each piece contributes only its outer contour.
 */
export async function traceOutline(mask: Mask): Promise<string> {
  const png = await maskSharp(mask).negate().png().toBuffer(); // black shape on white
  const tracer = new Potrace({ turdSize: 50, optTolerance: 0.4, threshold: 128, blackOnWhite: true });
  await new Promise<void>((resolve, reject) => tracer.loadImage(png, (err) => (err ? reject(err) : resolve())));
  const tag = tracer.getPathTag("#000");
  return /\sd="([^"]*)"/.exec(tag)?.[1]?.trim() ?? "";
}

/** Largest upscale ensureDpi applies; beyond this the art would print visibly soft, so the resolution check fails instead. */
export const MAX_UPSCALE = 2;

/**
 * Lanczos upscale (at most ×2) so the short side reaches `minShortSide` (900 px = 3 in at 300 dpi
 * by default). Alpha is kept. With `dpi`, the PNG also carries that density.
 */
export async function ensureDpi(png: Buffer, minShortSide = MIN_SHORT_SIDE, dpi?: number): Promise<Buffer> {
  const meta = await sharp(png).metadata();
  const w = meta.width ?? 0, h = meta.height ?? 0;
  if (!w || !h) return png;
  const short = Math.min(w, h);
  if (short >= minShortSide) return dpi ? sharp(png).withMetadata({ density: dpi }).png().toBuffer() : png;
  const scale = Math.min(MAX_UPSCALE, minShortSide / short);
  const out = sharp(png).resize(Math.round(w * scale), Math.round(h * scale), { kernel: "lanczos3" });
  return (dpi ? out.withMetadata({ density: dpi }) : out).png().toBuffer();
}

/**
 * Applies the mask as alpha and trims to its bounding box. An `AlphaMask` (from `finishMask`) is
 * used as-is, so the edge stays anti-aliased; a binary `Mask` becomes a hard 0/255 alpha.
 * The image is resized to the mask size when they differ (finishArtwork passes them equal).
 */
export async function removeBackground(png: Buffer, mask: Mask | AlphaMask): Promise<{ png: Buffer; mask: Mask; bbox: BBox }> {
  const soft = "alpha" in mask;
  const alpha = soft ? Buffer.from(mask.alpha) : maskToGrey(mask);
  const binary = soft ? alphaToMask(mask) : mask;
  const visible = soft ? alphaToMask(mask, 0) : mask;
  const bbox = bboxOf(visible);
  if (!bbox || !bboxOf(binary)) throw new Error("Mask is empty");
  const { width, height } = mask;
  // removeAlpha is applied at output time by sharp, so materialize RGB first, then join the mask as alpha.
  const rgb = await sharp(png).rotate().resize(width, height, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const [x0, y0, x1, y1] = bbox;
  const withAlpha = await sharp(rgb, { raw: { width, height, channels: 3 } })
    .joinChannel(alpha, { raw: { width, height, channels: 1 } }).png().toBuffer();
  const cut = await sharp(withAlpha).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).png().toBuffer();
  return { png: cut, mask: cropMask(binary, bbox), bbox };
}

/**
 * The upscale (1 to MAX_UPSCALE) that brings a cut of `bbox` up to `minShortSide`. Applied to the
 * opaque original before cutting, so the RGBA cut is never resampled (no fringe on soft edges).
 */
export function cutUpscale(bbox: BBox, minShortSide = MIN_SHORT_SIDE): number {
  const short = Math.min(bbox[2] - bbox[0], bbox[3] - bbox[1]);
  if (short <= 0 || short >= minShortSide) return 1;
  return Math.min(MAX_UPSCALE, minShortSide / short);
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
  // Every island keeps its own border; islands within 2 × border of each other merge into one.
  const cut = await offsetMask(padded, borderPx);
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
  const cut = await offsetMask(padMask(mask, pad), borderPx);
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
