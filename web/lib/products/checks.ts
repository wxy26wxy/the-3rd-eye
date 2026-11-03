/**
 * Print checks (pure image math, no model calls). The listing agent's tools call these, and the
 * server runs them itself so the publish gate never depends on what the model claims.
 *
 * Round 3 (T134, ruling 2): resolution is the only hard gate, measured on the artwork's cleaned PNG
 * allowing one further ×2 upscale; contrast is a warning measured on colour (CIE Lab lightness spread
 * and chroma) over the opaque pixels only. `print_ok` is true only when neither is flagged; `check`
 * names the flagged one (resolution first).
 */
import sharp from "sharp";
import { PRINT_SPECS, type ProductKind } from "./registry";

/** Upscale the print pipeline may still apply to the cleaned PNG (one ×2). */
export const RESOLUTION_UPSCALE = 2;
/** Contrast passes when the lightness spread (L*, p95 − p5) reaches this… */
export const MIN_LIGHTNESS_SPREAD = 30;
/** …or the colourfulness (chroma C*, p90) reaches this. */
export const MIN_CHROMA = 25;
/** Pixels at or above this alpha count as part of the art. */
const OPAQUE_ALPHA = 128;
/** Longest side the contrast is measured at (statistics, not detail). */
const CONTRAST_SIDE = 512;

export type ResolutionCheck = { ok: boolean; width: number; height: number; requiredShortSidePx: number; maxPrintInches: number; message: string };
export type ContrastCheck = {
  ok: boolean; warning: true; lightnessSpread: number; chroma: number;
  /** L* statistics (0–100) over the opaque pixels, kept for the trace. */
  stdev: number; range: number; mean: number; message: string;
};
export type PrintIssue = "resolution" | "contrast";
export type PrintCheck = { version: 2; print_ok: boolean; check: PrintIssue | null; resolution: ResolutionCheck; contrast: ContrastCheck; notes: string; acceptedWarning?: boolean };

/** Is the cleaned art big enough for the product's target size, allowing one ×2 upscale? (`width`/`height`: the cleaned PNG.) */
export function checkResolution(ctx: { productType: ProductKind; width: number; height: number }): ResolutionCheck {
  const spec = PRINT_SPECS[ctx.productType];
  const short = Math.min(ctx.width, ctx.height);
  const printable = short * RESOLUTION_UPSCALE;
  const maxPrintInches = Math.round((printable / spec.dpi) * 10) / 10;
  const ok = printable >= spec.minShortSidePx;
  return {
    ok, width: ctx.width, height: ctx.height, requiredShortSidePx: spec.minShortSidePx, maxPrintInches,
    message: ok
      ? `Sharp enough for a ${spec.targetInches} in ${ctx.productType} at ${spec.dpi} dpi.`
      : `Too small for a ${spec.targetInches} in ${ctx.productType}: the cutout's short side is ${short}px, it needs at least ${Math.ceil(spec.minShortSidePx / RESOLUTION_UPSCALE)}px.`,
  };
}

/** Judges contrast from colour statistics: lightness spread (L*, 0–100) or chroma (C*). */
export function contrastFromStats(s: { lightnessSpread: number; chroma: number; stdev?: number; range?: number; mean?: number }): ContrastCheck {
  const ok = s.lightnessSpread >= MIN_LIGHTNESS_SPREAD || s.chroma >= MIN_CHROMA;
  return {
    ok, warning: true, lightnessSpread: Math.round(s.lightnessSpread), chroma: Math.round(s.chroma),
    stdev: Math.round(s.stdev ?? 0), range: Math.round(s.range ?? 0), mean: Math.round(s.mean ?? 0),
    message: ok ? "Good contrast: shapes will read clearly when printed." : "Low contrast: the design may look faint when printed.",
  };
}

const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);

/** sRGB (0–255) → CIE L*a*b* (D65). */
export function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const pct = (sorted: Float64Array, p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];

/** Contrast of the art's opaque pixels (the transparent background is ignored). */
export async function measureContrast(png: Buffer): Promise<ContrastCheck> {
  const { data, info } = await sharp(png).ensureAlpha()
    .resize(CONTRAST_SIDE, CONTRAST_SIDE, { fit: "inside", withoutEnlargement: true })
    .raw().toBuffer({ resolveWithObject: true });
  const L: number[] = [], C: number[] = [];
  for (let i = 0; i < info.width * info.height; i++) {
    const o = i * info.channels;
    if (data[o + 3] < OPAQUE_ALPHA) continue;
    const [l, a, b] = srgbToLab(data[o], data[o + 1], data[o + 2]);
    L.push(l);
    C.push(Math.hypot(a, b));
  }
  if (!L.length) return contrastFromStats({ lightnessSpread: 0, chroma: 0 });
  const ls = Float64Array.from(L).sort(), cs = Float64Array.from(C).sort();
  const mean = L.reduce((s, v) => s + v, 0) / L.length;
  const stdev = Math.sqrt(L.reduce((s, v) => s + (v - mean) ** 2, 0) / L.length);
  return contrastFromStats({
    lightnessSpread: pct(ls, 0.95) - pct(ls, 0.05), chroma: pct(cs, 0.9),
    stdev, range: ls[ls.length - 1] - ls[0], mean,
  });
}

/** Resolution failures come first (the hard gate); a contrast warning is reported when resolution is fine. */
export function printCheckFrom(resolution: ResolutionCheck, contrast: ContrastCheck): PrintCheck {
  const check: PrintIssue | null = !resolution.ok ? "resolution" : !contrast.ok ? "contrast" : null;
  const notes = [resolution, contrast].filter((c) => !c.ok).map((c) => c.message).join(" ");
  return { version: 2, print_ok: check === null, check, resolution, contrast, notes };
}

/** Both checks on an artwork's cleaned PNG. */
export async function measurePrintCheck(productType: ProductKind, cleanedPng: Buffer): Promise<PrintCheck> {
  const meta = await sharp(cleanedPng).metadata();
  return printCheckFrom(checkResolution({ productType, width: meta.width ?? 0, height: meta.height ?? 0 }), await measureContrast(cleanedPng));
}
