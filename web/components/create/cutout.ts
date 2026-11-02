/**
 * Photo and cut-out helpers for the creator flow, kept free of React so they can be unit-tested.
 * (Adjust the area's frame geometry is in `area.ts`.)
 *
 * Coordinates sent to the API are pixels of the stored original (`imageSize`, docs/api.md T080
 * clarification 1): origin top-left, x right, y down.
 */

export type ImageSize = { w: number; h: number };
/** `[x0, y0, x1, y1]` in pixels of the stored original (half-open). */
export type Box = [number, number, number, number];
export type CleanupDetails = { failedProductIds?: string[]; unpublishedProductIds?: string[] };

export function usableSize(size: ImageSize | null | undefined): size is ImageSize {
  return !!size && Number.isFinite(size.w) && Number.isFinite(size.h) && size.w > 0 && size.h > 0;
}

/** A box in image pixels → percentages of the shown image (for CSS `left/top/width/height`). */
export function percentRect(box: readonly number[], image: ImageSize): { left: number; top: number; width: number; height: number } | null {
  if (box.length !== 4 || !usableSize(image)) return null;
  const [x0, y0, x1, y1] = box;
  return { left: (x0 / image.w) * 100, top: (y0 / image.h) * 100, width: ((x1 - x0) / image.w) * 100, height: ((y1 - y0) / image.h) * 100 };
}

/** One plain line per kind of product trouble; the cut-out itself was saved either way. */
export function productNotice(details: CleanupDetails | null | undefined, copy: { failed: string; unpublished: string }): string | null {
  const lines: string[] = [];
  if (details?.failedProductIds?.length) lines.push(copy.failed);
  if (details?.unpublishedProductIds?.length) lines.push(copy.unpublished);
  return lines.length ? lines.join(" ") : null;
}

/** How long the presigned `originalUrl` is trusted before it is fetched again (it lives 10 minutes). */
export const ORIGINAL_URL_TTL_MS = 9 * 60 * 1000;

/**
 * `POST /artworks` (photo) answered 422 `no_drawing_found` but kept the artwork: its id, so the
 * creator can frame the drawing on that photo (Adjust the area) instead of retaking it. Else null.
 */
export function boxRescueArtworkId(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const e = err as { status?: unknown; code?: unknown; extra?: { artworkId?: unknown } };
  return e.status === 422 && e.code === "no_drawing_found" && typeof e.extra?.artworkId === "string" && e.extra.artworkId ? e.extra.artworkId : null;
}
