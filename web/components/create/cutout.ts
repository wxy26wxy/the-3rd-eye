/**
 * Adjust-cutout logic for the Select screen, kept free of React so it can be unit-tested.
 *
 * Coordinates sent to the API are pixels of the stored original (`imageSize`, docs/api.md T080
 * clarification 1): origin top-left, x right, y down. The photo is shown aspect-fit inside a
 * frame, so a tap is mapped as `x = (tapX - imageLeft) * imageSize.w / shownWidth` (same for y).
 */

export type ImageSize = { w: number; h: number };
export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type XY = { x: number; y: number };
export type Box = [number, number, number, number];
export type CutoutPoint = { x: number; y: number; label: "positive" | "negative" };
export type CleanupRequest = { candidateIds?: string[]; points?: CutoutPoint[]; box?: Box };
export type CleanupDetails = { failedProductIds?: string[]; unpublishedProductIds?: string[] };
export type Piece = { id: string; bbox: readonly number[] };

/** The API takes at most 10 points and 6 candidate ids. */
export const MAX_POINTS = 10;
export const MAX_CANDIDATES = 6;

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

/**
 * A point in container coordinates → image pixels. Null when it falls in the letterbox around
 * the shown image (unless `clamp`, used for box drags that end outside the picture).
 */
export function imagePoint(p: XY, frame: Rect, image: ImageSize, clamp = false): XY | null {
  if (frame.width <= 0 || frame.height <= 0 || !usableSize(image)) return null;
  const x = ((p.x - frame.x) * image.w) / frame.width;
  const y = ((p.y - frame.y) * image.h) / frame.height;
  const inside = x >= 0 && y >= 0 && x <= image.w && y <= image.h;
  if (!inside && !clamp) return null;
  return { x: Math.min(Math.max(x, 0), image.w), y: Math.min(Math.max(y, 0), image.h) };
}

/** A drag from `a` to `b` (container coordinates) → a box in image pixels; null when empty. */
export function imageBox(a: XY, b: XY, frame: Rect, image: ImageSize): Box | null {
  const p = imagePoint(a, frame, image, true);
  const q = imagePoint(b, frame, image, true);
  if (!p || !q) return null;
  const box: Box = [Math.min(p.x, q.x), Math.min(p.y, q.y), Math.max(p.x, q.x), Math.max(p.y, q.y)];
  return box[0] < box[2] && box[1] < box[3] ? box : null;
}

/** A box in image pixels → percentages of the shown image (for CSS `left/top/width/height`). */
export function percentRect(box: readonly number[], image: ImageSize): { left: number; top: number; width: number; height: number } | null {
  if (box.length !== 4 || !usableSize(image)) return null;
  const [x0, y0, x1, y1] = box;
  return { left: (x0 / image.w) * 100, top: (y0 / image.h) * 100, width: ((x1 - x0) / image.w) * 100, height: ((y1 - y0) / image.h) * 100 };
}

/**
 * The cleanup body exactly as the creator composed it: the chosen pieces go with every mark and
 * box. Null when there is nothing to send, or when only "Remove area" marks exist with no piece
 * and no box (the API needs a positive point then).
 */
export function makeRequest(selectedIds: readonly string[], points: readonly CutoutPoint[], box: Box | null): CleanupRequest | null {
  const ids = selectedIds.slice(0, MAX_CANDIDATES);
  if (!ids.length && !points.length && !box) return null;
  if (!ids.length && !box && !points.some((p) => p.label === "positive")) return null;
  const req: CleanupRequest = {};
  if (ids.length) req.candidateIds = [...ids];
  if (points.length) req.points = points.slice(0, MAX_POINTS).map((p) => ({ ...p }));
  if (box) req.box = [...box] as Box;
  return req;
}

export type CutoutAction = { kind: "select"; candidateId: string } | { kind: "cleanup"; body: CleanupRequest };

/** `select` for one piece and no marks (same as before), otherwise `cleanup`. */
export function chooseAction(selectedIds: readonly string[], points: readonly CutoutPoint[], box: Box | null): CutoutAction | null {
  if (selectedIds.length === 1 && !points.length && !box) return { kind: "select", candidateId: selectedIds[0] };
  const body = makeRequest(selectedIds, points, box);
  return body ? { kind: "cleanup", body } : null;
}

export function sameRequest(a: CleanupRequest | null, b: CleanupRequest | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function inBox(bbox: readonly number[], p: XY): boolean {
  return bbox.length === 4 && p.x >= bbox[0] && p.x < bbox[2] && p.y >= bbox[1] && p.y < bbox[3];
}

/**
 * A "Remove area" mark drops the whole chosen piece it lands on (docs/api.md T080 §2). True when
 * the marks would drop every chosen piece and nothing else (a box or an "Add area" mark) is left.
 */
export function leavesNothing(selected: readonly Piece[], points: readonly CutoutPoint[], box: Box | null): boolean {
  if (box || !selected.length || points.some((p) => p.label === "positive")) return false;
  const negatives = points.filter((p) => p.label === "negative");
  return selected.every((piece) => negatives.some((n) => inBox(piece.bbox, n)));
}

/** "Box around this piece": the piece's own bbox. */
export function boxAround(piece: Piece): Box | null {
  const b = piece.bbox;
  return b.length === 4 && b[0] < b[2] && b[1] < b[3] ? [b[0], b[1], b[2], b[3]] : null;
}

/** "Add the area around this piece": a positive point at the centre of its bbox. */
export function centrePoint(piece: Piece): CutoutPoint | null {
  const b = boxAround(piece);
  return b ? { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2, label: "positive" } : null;
}

/** One plain line per kind of product trouble; the cut-out itself was saved either way. */
export function productNotice(details: CleanupDetails | null | undefined, copy: { failed: string; unpublished: string }): string | null {
  const lines: string[] = [];
  if (details?.failedProductIds?.length) lines.push(copy.failed);
  if (details?.unpublishedProductIds?.length) lines.push(copy.unpublished);
  return lines.length ? lines.join(" ") : null;
}

/**
 * A cleanup answered 422 ("nothing left to cut") after "Remove area" marks were sent: show the
 * trim advice instead of the server's reason. Any other failure keeps its own message.
 */
export function needsTrimAdvice(err: unknown, sent: CleanupRequest | null | undefined): boolean {
  const status = typeof err === "object" && err !== null ? (err as { status?: unknown }).status : undefined;
  return status === 422 && !!sent?.points?.some((p) => p.label === "negative");
}

/** How long the presigned `originalUrl` is trusted before it is fetched again (it lives 10 minutes). */
export const ORIGINAL_URL_TTL_MS = 9 * 60 * 1000;

/** The last cut saved by "Apply cutout", kept in the draft so a reload keeps it (and "Use this" does not cut again). */
export type AppliedCutout = { artworkId: string; request: CleanupRequest; cleanedUrl: string | null; altText: string | null };
export type Choice = { selectedIds: string[]; points: CutoutPoint[]; box: Box | null };

/**
 * The creator's choice after a reload: the saved cut's request when it belongs to this artwork
 * and names only pieces that still exist; otherwise the first piece (none when SAM found none).
 */
export function initialChoice(saved: AppliedCutout | null | undefined, artworkId: string, pieces: readonly { id: string }[]): Choice & { restored: boolean } {
  const known = new Set(pieces.map((p) => p.id));
  const ids = saved?.request.candidateIds ?? [];
  if (saved && saved.artworkId === artworkId && ids.every((id) => known.has(id))) {
    return { selectedIds: [...ids], points: (saved.request.points ?? []).map((p) => ({ ...p })), box: saved.request.box ? ([...saved.request.box] as Box) : null, restored: true };
  }
  return { selectedIds: pieces[0] ? [pieces[0].id] : [], points: [], box: null, restored: false };
}

/**
 * `POST /artworks` (photo) answered 422 `no_drawing_found` but kept the artwork: its id, so the
 * creator can draw a box around the drawing on that photo instead of retaking it. Else null.
 */
export function boxRescueArtworkId(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const e = err as { status?: unknown; code?: unknown; details?: { artworkId?: unknown } };
  return e.status === 422 && e.code === "no_drawing_found" && typeof e.details?.artworkId === "string" && e.details.artworkId ? e.details.artworkId : null;
}

/** "Use the whole photo": a box over the entire image (keyboard alternative to dragging one). */
export function wholeImageBox(image: ImageSize | null | undefined): Box | null {
  return usableSize(image) ? [0, 0, image.w, image.h] : null;
}

/** Marks exist but no request can be sent (only "Remove area" marks and no piece): Apply and Use this stay disabled. */
export function isStuck(selectedIds: readonly string[], points: readonly CutoutPoint[], box: Box | null): boolean {
  return !makeRequest(selectedIds, points, box) && (points.length > 0 || box !== null);
}
