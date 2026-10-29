/**
 * Product types. Each entry knows its print spec, mockup prompt, price range and how to
 * build print files + mockup from a ready artwork.
 */
import "server-only";
import type { ImageProvider, Trace } from "@/lib/ai/types";

export type ProductKind = "sticker" | "tote";

export type PrintSpec = { dpi: number; targetInches: number; minShortSidePx: number; borderMm?: number; bleedMm?: number };
export type BuiltProduct = { printPng?: Buffer; printSvg?: string; mockupPng: Buffer; cutPath?: string };

export type ProductSpec = {
  kind: ProductKind;
  label: string;
  printSpec: PrintSpec;
  mockupPrompt: string;
  priceRange: { min: number; max: number };
  build(artwork: { cleanedPng: Buffer }, deps: { image: ImageProvider; trace: Trace }): Promise<BuiltProduct>;
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

async function buildSticker(artwork: { cleanedPng: Buffer }, deps: { image: ImageProvider; trace: Trace }): Promise<BuiltProduct> {
  const { composeSticker } = await import("@/lib/ai/meta/sticker");
  const { makeMockup } = await import("@/lib/ai/meta/mockup");
  const files = await composeSticker(artwork.cleanedPng, { borderMm: PRINT_SPECS.sticker.borderMm, bleedMm: PRINT_SPECS.sticker.bleedMm });
  const mockupPng = await makeMockup(deps.image, { kind: "sticker", prompt: MOCKUP_PROMPTS.sticker, artPng: files.printPng, trace: deps.trace });
  return { printPng: files.printPng, printSvg: files.dieCutSvg, cutPath: files.cutPath, mockupPng };
}

/** Tote print file: the cleaned art (transparent background kept) at 150 dpi, short side ≥ 1500 px (10 in). */
async function buildTote(artwork: { cleanedPng: Buffer }, deps: { image: ImageProvider; trace: Trace }): Promise<BuiltProduct> {
  const { ensureDpi } = await import("@/lib/ai/meta/sticker");
  const { makeMockup } = await import("@/lib/ai/meta/mockup");
  const spec = PRINT_SPECS.tote;
  const printPng = await ensureDpi(artwork.cleanedPng, spec.minShortSidePx, spec.dpi);
  const mockupPng = await makeMockup(deps.image, { kind: "tote", prompt: MOCKUP_PROMPTS.tote, artPng: artwork.cleanedPng, trace: deps.trace });
  return { printPng, mockupPng };
}

export const PRODUCTS: Record<ProductKind, ProductSpec> = {
  sticker: { kind: "sticker", label: "Sticker", printSpec: PRINT_SPECS.sticker, mockupPrompt: MOCKUP_PROMPTS.sticker, priceRange: PRICE_RANGES.sticker, build: buildSticker },
  tote: { kind: "tote", label: "Tote bag", printSpec: PRINT_SPECS.tote, mockupPrompt: MOCKUP_PROMPTS.tote, priceRange: PRICE_RANGES.tote, build: buildTote },
};

export function productSpec(kind: ProductKind): ProductSpec {
  return PRODUCTS[kind];
}
