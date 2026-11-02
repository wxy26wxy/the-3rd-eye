import { m } from "@/components/messages";
import type { ProductType } from "@/lib/db/queries.contract";

/**
 * Sticker sizes and their price steps (ruling R1, sample pricing): 3 in = listed price, 4 in = +$2,
 * sticker sheet = +$6; a tote has no size. Mirrors the `sizes` in `lib/products/registry.ts` (T111),
 * which is server-only; the server computes the charged amount, this only shows it.
 */
export type SizeKey = "3in" | "4in" | "sheet";
export type SizeOption = { key: SizeKey; label: string; addCents: number };

export const STICKER_SIZES: SizeOption[] = [
  { key: "3in", label: m.product.size3in, addCents: 0 },
  { key: "4in", label: m.product.size4in, addCents: 200 },
  { key: "sheet", label: m.product.sizeSheet, addCents: 600 },
];

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10;

export function sizesFor(type: ProductType): SizeOption[] {
  return type === "sticker" ? STICKER_SIZES : [];
}

export function unitCents(baseCents: number, size: SizeKey | null): number {
  return baseCents + (STICKER_SIZES.find((s) => s.key === size)?.addCents ?? 0);
}

export function clampQuantity(n: number): number {
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.round(Number.isFinite(n) ? n : MIN_QUANTITY)));
}
