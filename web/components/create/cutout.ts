/**
 * Photo and cut-out helpers for the creator flow, kept free of React so they can be unit-tested.
 * (Adjust the area's frame geometry is in `area.ts`.)
 *
 * Coordinates sent to the API are pixels of the stored original (`imageSize`, docs/api.md T080
 * clarification 1): origin top-left, x right, y down.
 */

export type ImageSize = { w: number; h: number };
export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type XY = { x: number; y: number };
/** `[x0, y0, x1, y1]` in pixels of the stored original (half-open). */
export type Box = [number, number, number, number];
/** An Add area (`positive`) or Remove area (`negative`) mark on Your cutout. */
export type CutoutPoint = { x: number; y: number; label: "positive" | "negative" };
/** The `cleanup` body Your cutout sends: the piece, the box (the frame, or the whole picture after a change), the marks, clipped to the box. */
export type CleanupRequest = { candidateIds?: string[]; box: Box; points?: CutoutPoint[]; clipToBox: true };

/** The API takes at most 10 points and 6 candidate ids. */
export const MAX_POINTS = 10;
export const MAX_CANDIDATES = 6;
export type CleanupDetails = { failedProductIds?: string[]; unpublishedProductIds?: string[] };

export function usableSize(size: ImageSize | null | undefined): size is ImageSize {
  return !!size && Number.isFinite(size.w) && Number.isFinite(size.h) && size.w > 0 && size.h > 0;
}

/** Where an image of `image` size sits when aspect-fit (`object-fit: contain`) into `container`. */
export function fitRect(image: ImageSize, container: Size): Rect {
  if (!usableSize(image) || container.width <= 0 || container.height <= 0) return { x: 0, y: 0, width: 0, height: 0 };
  const scale = Math.min(container.width / image.w, container.height / image.h);
  const width = image.w * scale;
  const height = image.h * scale;
  return { x: (container.width - width) / 2, y: (container.height - height) / 2, width, height };
}

/** A point in container coordinates → image pixels; null when it falls in the letterbox around the shown image. */
export function imagePoint(p: XY, frame: Rect, image: ImageSize): XY | null {
  if (frame.width <= 0 || frame.height <= 0 || !usableSize(image)) return null;
  const x = ((p.x - frame.x) * image.w) / frame.width;
  const y = ((p.y - frame.y) * image.h) / frame.height;
  return x >= 0 && y >= 0 && x <= image.w && y <= image.h ? { x, y } : null;
}

/** The whole picture as a box (the box Your cutout sends after a change). */
export function wholeImageBox(image: ImageSize | null | undefined): Box | null {
  return usableSize(image) ? [0, 0, image.w, image.h] : null;
}

/**
 * Your cutout's `cleanup` body (T130): the piece (`candidateIds`, when there is one), the box, the
 * marks (at most 10) and `clipToBox: true`, so the cut never reaches past the frame.
 */
export function marksRequest(candidateIds: readonly string[], box: Box, points: readonly CutoutPoint[]): CleanupRequest {
  const ids = candidateIds.slice(0, MAX_CANDIDATES);
  const marks = points.slice(0, MAX_POINTS).map((p) => ({ ...p }));
  return { ...(ids.length ? { candidateIds: [...ids] } : {}), box: [...box] as Box, ...(marks.length ? { points: marks } : {}), clipToBox: true };
}

/** The same marks in the same order (the saved cut is the one on screen). */
export function sameMarks(a: readonly CutoutPoint[], b: readonly CutoutPoint[]): boolean {
  return a.length === b.length && a.every((p, i) => p.x === b[i].x && p.y === b[i].y && p.label === b[i].label);
}

/** "Add the area around your art" (keyboard and screen readers): an Add area mark at the centre of the piece, else of the box. */
export function centrePoint(box: readonly number[] | null | undefined): CutoutPoint | null {
  if (!box || box.length !== 4 || !(box[0] < box[2] && box[1] < box[3])) return null;
  return { x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2, label: "positive" };
}

/** A 422 ("nothing left to cut") after Remove area marks were sent: the trim advice, not the server's reason. */
export function needsTrimAdvice(err: unknown, sent: CleanupRequest | null | undefined): boolean {
  const status = typeof err === "object" && err !== null ? (err as { status?: unknown }).status : undefined;
  return status === 422 && !!sent?.points?.some((p) => p.label === "negative");
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
