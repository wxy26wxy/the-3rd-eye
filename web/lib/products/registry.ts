/**
 * Product types. Each entry knows its print spec, mockup prompt, price range and how to
 * build print files + mockup from a ready artwork.
 */
import "server-only";
import type { MockupMaker, Trace } from "@/lib/ai/types";

export type ProductKind = "sticker" | "tote";

export type PrintSpec = { dpi: number; targetInches: number; minShortSidePx: number; borderMm?: number; bleedMm?: number };
export type BuiltProduct = { printPng?: Buffer; printSvg?: string; mockupPng: Buffer; cutPath?: string };

export type ProductSpec = {
  kind: ProductKind;
  label: string;
  printSpec: PrintSpec;
  mockupPrompt: string;
  priceRange: { min: number; max: number };
  build(artwork: { cleanedPng: Buffer }, deps: { mockups: MockupMaker; trace: Trace }): Promise<BuiltProduct>;
  /** Print files only (no model calls); used by build() and to repair products made before a print file existed. */
  buildPrint(cleanedPng: Buffer): Promise<{ printPng: Buffer; printSvg?: string; cutPath?: string }>;
};

export const PRICE_RANGES: Record<ProductKind, { min: number; max: number }> = {
  sticker: { min: 400, max: 700 },
  tote: { min: 2200, max: 3000 },
};

export const PRINT_SPECS: Record<ProductKind, PrintSpec> = {
  sticker: { dpi: 300, targetInches: 3, minShortSidePx: 900, borderMm: 3, bleedMm: 1.5 },
  tote: { dpi: 150, targetInches: 10, minShortSidePx: 1500 },
};

export const MOCKUP_PROMPTS: Record<ProductKind, string> = {
  sticker:
    "Product photo of this exact artwork as a die-cut vinyl sticker with a white border, stuck on a light wooden desk next to a notebook. " +
    "Keep the artwork exactly as given: same shapes, colors and outline. Soft daylight, realistic, no text.",
  tote:
    "Product photo: print this exact artwork, centered and large, on the front of the canvas tote bag shown in the second image. " +
    "Keep the artwork exactly as given. Plain light background, soft daylight, realistic fabric texture, no text.",
};

async function stickerPrint(cleanedPng: Buffer) {
  const { composeSticker } = await import("@/lib/image/sticker");
  const files = await composeSticker(cleanedPng, { borderMm: PRINT_SPECS.sticker.borderMm, bleedMm: PRINT_SPECS.sticker.bleedMm });
  return { printPng: files.printPng, printSvg: files.dieCutSvg, cutPath: files.cutPath };
}

async function buildSticker(artwork: { cleanedPng: Buffer }, deps: { mockups: MockupMaker; trace: Trace }): Promise<BuiltProduct> {
  const files = await stickerPrint(artwork.cleanedPng);
  const mockupPng = await deps.mockups.make({ kind: "sticker", prompt: MOCKUP_PROMPTS.sticker, artPng: files.printPng, trace: deps.trace });
  return { ...files, mockupPng };
}

/** Tote print file: the cleaned art (transparent background kept) at 150 dpi, short side ≥ 1500 px (10 in). */
async function totePrint(cleanedPng: Buffer) {
  const { ensureDpi } = await import("@/lib/image/sticker");
  return { printPng: await ensureDpi(cleanedPng, PRINT_SPECS.tote.minShortSidePx, PRINT_SPECS.tote.dpi) };
}

async function buildTote(artwork: { cleanedPng: Buffer }, deps: { mockups: MockupMaker; trace: Trace }): Promise<BuiltProduct> {
  const files = await totePrint(artwork.cleanedPng);
  const mockupPng = await deps.mockups.make({ kind: "tote", prompt: MOCKUP_PROMPTS.tote, artPng: artwork.cleanedPng, trace: deps.trace });
  return { ...files, mockupPng };
}

export const PRODUCTS: Record<ProductKind, ProductSpec> = {
  sticker: { kind: "sticker", label: "Sticker", printSpec: PRINT_SPECS.sticker, mockupPrompt: MOCKUP_PROMPTS.sticker, priceRange: PRICE_RANGES.sticker, build: buildSticker, buildPrint: stickerPrint },
  tote: { kind: "tote", label: "Tote bag", printSpec: PRINT_SPECS.tote, mockupPrompt: MOCKUP_PROMPTS.tote, priceRange: PRICE_RANGES.tote, build: buildTote, buildPrint: totePrint },
};

export function productSpec(kind: ProductKind): ProductSpec {
  return PRODUCTS[kind];
}
