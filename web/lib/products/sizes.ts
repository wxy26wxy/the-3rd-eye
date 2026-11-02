/**
 * Product sizes and their price steps (T111, design v3 "Size"). Sample pricing: the sticker's
 * listed price is the 3 in price; bigger sizes add a fixed amount. Totes have one size.
 * Not server-only: the product page's size picker reads the same table.
 */
export type ProductKindForSize = "sticker" | "tote";
export type SizeKey = "3in" | "4in" | "sheet";
/** `key` is also the label key in en.json `product.sizes`. */
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

/**
 * The size an order is placed with: the default when none was sent; null for products without sizes.
 * Throws `invalid_size` for an unknown size or a size on a product that has none.
 */
export function resolveSize(kind: ProductKindForSize, size: string | null | undefined): SizeKey | null {
  const options = SIZES[kind];
  if (size === undefined || size === null || size === "") return DEFAULT_SIZE[kind];
  const hit = options.find((o) => o.key === size);
  if (!hit) throw new SizeError(options.length ? "Pick one of the sizes shown" : "This product has one size");
  return hit.key;
}

/** Price of one item in `size` (listed price plus the size step). */
export function unitCents(product: { type: ProductKindForSize; priceCents: number }, size: SizeKey | null): number {
  const step = size ? SIZES[product.type].find((o) => o.key === size)?.addCents ?? 0 : 0;
  return product.priceCents + step;
}

export class SizeError extends Error {
  readonly code = "invalid_size";
}
