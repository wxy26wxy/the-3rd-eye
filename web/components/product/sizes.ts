import { m } from "@/components/messages";

/**
 * Sticker sizes and their price steps (ruling R1, sample pricing): 3 in = listed price, 4 in = +$2,
 * sticker sheet = +$6; a tote has no size. Same shape as `lib/products/sizes.ts` from T111 (the
 * server's table); when T111 is on main this file re-exports it. The server computes the charged
 * amount; the page only shows it.
 */
export type ProductKindForSize = "sticker" | "tote";
export type SizeKey = "3in" | "4in" | "sheet";
export type SizeOption = { key: SizeKey; addCents: number };

export const SIZES: Record<ProductKindForSize, readonly SizeOption[]> = {
  sticker: [
    { key: "3in", addCents: 0 },
    { key: "4in", addCents: 200 },
    { key: "sheet", addCents: 600 },
  ],
  tote: [],
};
export const DEFAULT_SIZE: Record<ProductKindForSize, SizeKey | null> = { sticker: "3in", tote: null };
export const MAX_QUANTITY = 10;

export function sizesFor(kind: ProductKindForSize): readonly SizeOption[] {
  return SIZES[kind];
}

/** Price of one item in `size` (listed price plus the size step). */
export function unitCents(product: { type: ProductKindForSize; priceCents: number }, size: SizeKey | null): number {
  const step = size ? SIZES[product.type].find((o) => o.key === size)?.addCents ?? 0 : 0;
  return product.priceCents + step;
}

// ---- page-side helpers (kept here after the swap)
export const MIN_QUANTITY = 1;
export const sizeLabel = (key: SizeKey): string => m.product.sizes[key];
export function clampQuantity(n: number): number {
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.round(Number.isFinite(n) ? n : MIN_QUANTITY)));
}
