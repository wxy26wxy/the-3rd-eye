import { m } from "@/components/messages";

/**
 * Sticker sizes and their price steps: the server's table (T111, `lib/products/sizes.ts`) re-exported,
 * so the page and `placeOrder` price the same way. The server computes the charged amount; the page
 * only shows it. Page-side helpers below.
 */
import { MAX_QUANTITY, type SizeKey } from "@/lib/products/sizes";
export {
  SIZES, DEFAULT_SIZE, MAX_QUANTITY, sizesFor, unitCents,
  type ProductKindForSize, type SizeKey, type SizeOption,
} from "@/lib/products/sizes";

// ---- page-side helpers (kept here after the swap)
export const MIN_QUANTITY = 1;
export const sizeLabel = (key: SizeKey): string => m.product.sizes[key];
export function clampQuantity(n: number): number {
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.round(Number.isFinite(n) ? n : MIN_QUANTITY)));
}
