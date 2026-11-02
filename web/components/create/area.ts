/**
 * Adjust the area (R2): the frame around the picked piece, in pixels of the stored original
 * (`imageSize`, the space of `Candidate.bbox` and of the cleanup `box`; docs/api.md T080 §1).
 * Free of React so the drag, keyboard and announcement rules can be unit-tested.
 */
import type { Box, ImageSize } from "./cutout";

/** How much the piece's bbox grows for the first frame (each side moves out by half of it). */
export const AREA_GROWTH = 0.08;
/** One arrow-key press moves or resizes the frame by this share of the photo. */
export const AREA_STEP = 0.05;
/**
 * The frame never gets smaller than this share of the photo's shorter side, so a pointer can still
 * grab its inside to move it (the 44 px handles sit outside the frame line; review T123 M2).
 */
export const AREA_MIN = 0.25;

/** Which part of the frame a pointer drags: a corner, an edge, or the whole frame. */
export type AreaHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "move";
export const AREA_CORNERS: readonly AreaHandle[] = ["nw", "ne", "se", "sw"];
export const AREA_EDGES: readonly AreaHandle[] = ["n", "e", "s", "w"];

function minSide(image: ImageSize): number {
  return Math.max(1, Math.min(image.w, image.h) * AREA_MIN);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/** The whole photo. */
export function wholeFrame(image: ImageSize): Box {
  return [0, 0, image.w, image.h];
}

/**
 * The first frame: the piece's bbox grown by 8 % (centred, clamped to the photo); the whole photo
 * when no piece was found or the bbox is unusable.
 */
export function initialFrame(bbox: readonly number[] | null | undefined, image: ImageSize): Box {
  if (!bbox || bbox.length !== 4 || !(bbox[0] < bbox[2]) || !(bbox[1] < bbox[3])) return wholeFrame(image);
  const [x0, y0, x1, y1] = bbox;
  const gx = ((x1 - x0) * AREA_GROWTH) / 2;
  const gy = ((y1 - y0) * AREA_GROWTH) / 2;
  return normalise([x0 - gx, y0 - gy, x1 + gx, y1 + gy], image);
}

/** Clamped to the photo, at least the minimum size, corners rounded to whole pixels. */
export function normalise(box: readonly number[], image: ImageSize): Box {
  const min = minSide(image);
  let x0 = clamp(Math.min(box[0], box[2]), 0, image.w);
  let x1 = clamp(Math.max(box[0], box[2]), 0, image.w);
  let y0 = clamp(Math.min(box[1], box[3]), 0, image.h);
  let y1 = clamp(Math.max(box[1], box[3]), 0, image.h);
  if (x1 - x0 < min) { x1 = Math.min(image.w, x0 + min); x0 = Math.max(0, x1 - min); }
  if (y1 - y0 < min) { y1 = Math.min(image.h, y0 + min); y0 = Math.max(0, y1 - min); }
  return [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)];
}

/** Moves the frame without changing its size; it stops at the photo's edges. */
export function moveFrame(box: Box, dx: number, dy: number, image: ImageSize): Box {
  const w = box[2] - box[0];
  const h = box[3] - box[1];
  const x0 = clamp(box[0] + dx, 0, image.w - w);
  const y0 = clamp(box[1] + dy, 0, image.h - h);
  return [Math.round(x0), Math.round(y0), Math.round(x0 + w), Math.round(y0 + h)];
}

/**
 * A pointer drag of `handle` by (dx, dy) image pixels from the frame `start` (the frame when the
 * drag began). Corners move two sides, edges one, "move" the whole frame. A side never crosses the
 * opposite one: the frame keeps the minimum size and stays on the photo.
 */
export function dragFrame(start: Box, handle: AreaHandle, dx: number, dy: number, image: ImageSize): Box {
  if (handle === "move") return moveFrame(start, dx, dy, image);
  const min = minSide(image);
  let [x0, y0, x1, y1] = start;
  if (handle.includes("w")) x0 = clamp(x0 + dx, 0, x1 - min);
  if (handle.includes("e")) x1 = clamp(x1 + dx, x0 + min, image.w);
  if (handle.includes("n")) y0 = clamp(y0 + dy, 0, y1 - min);
  if (handle.includes("s")) y1 = clamp(y1 + dy, y0 + min, image.h);
  return [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)];
}

/**
 * Grows (positive) or shrinks (negative) the frame around its centre by `dw` / `dh` image pixels,
 * kept on the photo and at least the minimum size.
 */
export function resizeFrame(box: Box, dw: number, dh: number, image: ImageSize): Box {
  const min = minSide(image);
  const w = clamp(box[2] - box[0] + dw, min, image.w);
  const h = clamp(box[3] - box[1] + dh, min, image.h);
  const cx = (box[0] + box[2]) / 2;
  const cy = (box[1] + box[3]) / 2;
  const x0 = clamp(cx - w / 2, 0, image.w - w);
  const y0 = clamp(cy - h / 2, 0, image.h - h);
  return [Math.round(x0), Math.round(y0), Math.round(x0 + w), Math.round(y0 + h)];
}

/**
 * Keyboard on the frame: arrows move it, Shift + arrows resize it (Right / Down grow, Left / Up
 * shrink), one step = 5 % of the photo. Null for any other key (the browser keeps it).
 */
export function keyFrame(box: Box, key: string, shift: boolean, image: ImageSize): Box | null {
  const sx = image.w * AREA_STEP;
  const sy = image.h * AREA_STEP;
  const d: Record<string, [number, number]> = { ArrowLeft: [-sx, 0], ArrowRight: [sx, 0], ArrowUp: [0, -sy], ArrowDown: [0, sy] };
  const step = d[key];
  if (!step) return null;
  return shift ? resizeFrame(box, step[0] * 2, step[1] * 2, image) : moveFrame(box, step[0], step[1], image);
}

/** The frame as whole percentages of the photo (for the announcement and the CSS position). */
export function framePercent(box: Box, image: ImageSize): { left: number; top: number; width: number; height: number } {
  return {
    left: (box[0] / image.w) * 100,
    top: (box[1] / image.h) * 100,
    width: ((box[2] - box[0]) / image.w) * 100,
    height: ((box[3] - box[1]) / image.h) * 100,
  };
}

/** Whole-number percentages for the live region ("…62 % of the width and 48 % of the height…"). */
export function frameSize(box: Box, image: ImageSize): { width: number; height: number; left: number; top: number } {
  const p = framePercent(box, image);
  return { width: Math.round(p.width), height: Math.round(p.height), left: Math.round(p.left), top: Math.round(p.top) };
}

export function sameBox(a: readonly number[] | null | undefined, b: readonly number[] | null | undefined): boolean {
  return !!a && !!b && a.length === 4 && b.length === 4 && a.every((v, i) => v === b[i]);
}
