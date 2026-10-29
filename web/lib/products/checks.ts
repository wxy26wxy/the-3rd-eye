/**
 * Print checks (pure image math, no model calls). The listing agent's tools call these, and the
 * server runs them itself so the publish gate never depends on what the model claims.
 */
import sharp from "sharp";
import { PRINT_SPECS, type ProductKind } from "./registry";

export type ResolutionCheck = { ok: boolean; width: number; height: number; requiredShortSidePx: number; maxPrintInches: number; message: string };
export type ContrastCheck = { ok: boolean; stdev: number; range: number; mean: number; message: string };
export type PrintCheck = { print_ok: boolean; resolution: ResolutionCheck; contrast: ContrastCheck; notes: string };

/** Is the print file big enough for the product's target size? */
export function checkResolution(ctx: { productType: ProductKind; width: number; height: number }): ResolutionCheck {
  const spec = PRINT_SPECS[ctx.productType];
  const short = Math.min(ctx.width, ctx.height);
  const maxPrintInches = Math.round((short / spec.dpi) * 10) / 10;
  const ok = short >= spec.minShortSidePx;
  return {
    ok, width: ctx.width, height: ctx.height, requiredShortSidePx: spec.minShortSidePx, maxPrintInches,
    message: ok
      ? `Sharp enough for a ${spec.targetInches} in ${ctx.productType} at ${spec.dpi} dpi.`
      : `Too small for a ${spec.targetInches} in ${ctx.productType}: short side ${short}px, needs ${spec.minShortSidePx}px.`,
  };
}

/** Judges contrast from greyscale statistics (0–255). */
export function contrastFromStats(s: { min: number; max: number; stdev: number; mean: number }): ContrastCheck {
  const range = s.max - s.min;
  const ok = s.stdev >= 25 && range >= 100;
  return {
    ok, stdev: Math.round(s.stdev), range, mean: Math.round(s.mean),
    message: ok ? "Good contrast: shapes will read clearly when printed." : "Low contrast: the design may look faint when printed.",
  };
}

/** Contrast of an image flattened on white. */
export async function measureContrast(png: Buffer): Promise<ContrastCheck> {
  const stats = await sharp(png).flatten({ background: "#ffffff" }).greyscale().stats();
  const c = stats.channels[0];
  return contrastFromStats({ min: c.min, max: c.max, stdev: c.stdev, mean: c.mean });
}

/** `print_ok` is true only when both checks passed; notes list what to fix. */
export function printCheckFrom(resolution: ResolutionCheck, contrast: ContrastCheck): PrintCheck {
  const print_ok = resolution.ok && contrast.ok;
  const notes = [resolution, contrast].filter((c) => !c.ok).map((c) => c.message).join(" ");
  return { print_ok, resolution, contrast, notes };
}
