/**
 * Binary mask utilities (row-major Uint8Array of 0/1). Pure image math on top of sharp;
 * no network. Used by the sticker pipeline, the SAM fallback and offline fixtures.
 */
import sharp from "sharp";

type Sharp = ReturnType<typeof sharp>;
import type { Mask } from "@/lib/ai/types";

export type BBox = [number, number, number, number]; // x0, y0, x1 (exclusive), y1 (exclusive)

export function emptyMask(width: number, height: number): Mask {
  return { width, height, data: new Uint8Array(width * height) };
}

async function greyRaw(img: Sharp): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  if (info.channels === 1) return { data, width: info.width, height: info.height };
  const out = Buffer.alloc(info.width * info.height);
  for (let i = 0; i < out.length; i++) out[i] = data[i * info.channels];
  return { data: out, width: info.width, height: info.height };
}

function fromGrey(grey: Buffer, width: number, height: number, threshold: number): Mask {
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) data[i] = grey[i] > threshold ? 1 : 0;
  return { width, height, data };
}

export function maskToGrey(mask: Mask): Buffer {
  const out = Buffer.alloc(mask.width * mask.height);
  for (let i = 0; i < out.length; i++) out[i] = mask.data[i] ? 255 : 0;
  return out;
}

export function maskSharp(mask: Mask): Sharp {
  return sharp(maskToGrey(mask), { raw: { width: mask.width, height: mask.height, channels: 1 } });
}

/** White = inside. */
export async function maskToPng(mask: Mask): Promise<Buffer> {
  return maskSharp(mask).png().toBuffer();
}

export async function maskFromPng(png: Buffer): Promise<Mask> {
  const g = await greyRaw(sharp(png).greyscale());
  return fromGrey(g.data, g.width, g.height, 127);
}

export async function maskFromAlpha(png: Buffer): Promise<Mask> {
  const g = await greyRaw(sharp(png).ensureAlpha().extractChannel("alpha"));
  return fromGrey(g.data, g.width, g.height, 127);
}

export function bboxOf(mask: Mask): BBox | null {
  let x0 = mask.width, y0 = mask.height, x1 = -1, y1 = -1;
  for (let y = 0; y < mask.height; y++) {
    const row = y * mask.width;
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[row + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
}

export function area(mask: Mask): number {
  let n = 0;
  for (let i = 0; i < mask.data.length; i++) n += mask.data[i];
  return n;
}

export function padMask(mask: Mask, pad: number): Mask {
  const width = mask.width + 2 * pad, height = mask.height + 2 * pad;
  const out = emptyMask(width, height);
  for (let y = 0; y < mask.height; y++) {
    out.data.set(mask.data.subarray(y * mask.width, (y + 1) * mask.width), (y + pad) * width + pad);
  }
  return out;
}

export function cropMask(mask: Mask, [x0, y0, x1, y1]: BBox): Mask {
  const out = emptyMask(x1 - x0, y1 - y0);
  for (let y = y0; y < y1; y++) out.data.set(mask.data.subarray(y * mask.width + x0, y * mask.width + x1), (y - y0) * out.width);
  return out;
}

/**
 * Morphological dilation by ~`radius` px using Gaussian blur + low threshold
 * (blur sigma r/2; an edge's blurred value falls to ~2.3% at 2 sigma). Pixels outside
 * the canvas are not created: pad first when the result must grow past the edges.
 */
export async function dilate(mask: Mask, radius: number): Promise<Mask> {
  if (radius < 0.6) return { ...mask, data: mask.data.slice() };
  const g = await greyRaw(maskSharp(mask).blur(Math.min(1000, radius / 2)));
  return fromGrey(g.data, g.width, g.height, 5);
}

/** Connected components (4-connectivity). Returns a label image (0 = background) and per-label stats. */
export function components(mask: Mask): { labels: Int32Array; parts: { label: number; area: number; bbox: BBox }[] } {
  const { width, height, data } = mask;
  const labels = new Int32Array(width * height);
  const parts: { label: number; area: number; bbox: BBox }[] = [];
  const queue = new Int32Array(width * height);
  let next = 0;
  for (let start = 0; start < data.length; start++) {
    if (!data[start] || labels[start]) continue;
    const label = ++next;
    let head = 0, tail = 0, count = 0;
    let x0 = width, y0 = height, x1 = 0, y1 = 0;
    queue[tail++] = start;
    labels[start] = label;
    while (head < tail) {
      const i = queue[head++];
      const x = i % width, y = (i - x) / width;
      count++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && data[i - 1] && !labels[i - 1]) { labels[i - 1] = label; queue[tail++] = i - 1; }
      if (x < width - 1 && data[i + 1] && !labels[i + 1]) { labels[i + 1] = label; queue[tail++] = i + 1; }
      if (y > 0 && data[i - width] && !labels[i - width]) { labels[i - width] = label; queue[tail++] = i - width; }
      if (y < height - 1 && data[i + width] && !labels[i + width]) { labels[i + width] = label; queue[tail++] = i + width; }
    }
    parts.push({ label, area: count, bbox: [x0, y0, x1 + 1, y1 + 1] });
  }
  return { labels, parts };
}

export function componentMask(mask: Mask, labels: Int32Array, label: number): Mask {
  const out = emptyMask(mask.width, mask.height);
  for (let i = 0; i < labels.length; i++) out.data[i] = labels[i] === label ? 1 : 0;
  return out;
}

/** Fills enclosed holes: anything not reachable from the border through background becomes foreground. */
export function fillHoles(mask: Mask): Mask {
  const { width, height, data } = mask;
  const outside = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let tail = 0;
  const seed = (i: number) => { if (!data[i] && !outside[i]) { outside[i] = 1; queue[tail++] = i; } };
  for (let x = 0; x < width; x++) { seed(x); seed((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { seed(y * width); seed(y * width + width - 1); }
  for (let head = 0; head < tail; head++) {
    const i = queue[head];
    const x = i % width;
    if (x > 0) seed(i - 1);
    if (x < width - 1) seed(i + 1);
    if (i >= width) seed(i - width);
    if (i < (height - 1) * width) seed(i + width);
  }
  const out = emptyMask(width, height);
  for (let i = 0; i < out.data.length; i++) out.data[i] = outside[i] ? 0 : 1;
  return out;
}

/** Otsu threshold over a 256-bin histogram. */
export function otsu(grey: Uint8Array | Buffer): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < grey.length; i++) hist[grey[i]]++;
  const total = grey.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; threshold = t; }
  }
  return threshold;
}

/** Foreground = darker than the paper (Otsu, capped so a pure-white background always counts as paper). */
export async function darkInkMask(png: Buffer): Promise<Mask> {
  const g = await greyRaw(sharp(png).flatten({ background: "#ffffff" }).greyscale());
  const t = Math.min(otsu(g.data), 235);
  const data = new Uint8Array(g.width * g.height);
  for (let i = 0; i < data.length; i++) data[i] = g.data[i] < t ? 1 : 0;
  return { width: g.width, height: g.height, data };
}

/**
 * Fallback segmentation without a model: ink mask → merge strokes (dilate ~1.5% of the short side)
 * → components above 0.5% of the image → filled silhouettes, largest first.
 */
export async function thresholdSegments(png: Buffer, maxParts = 6): Promise<{ mask: Mask; bbox: BBox; score: number }[]> {
  const ink = await darkInkMask(png);
  const merged = await dilate(ink, Math.max(2, Math.round(Math.min(ink.width, ink.height) * 0.015)));
  const { labels, parts } = components(merged);
  const minArea = ink.width * ink.height * 0.005;
  return parts
    .filter((p) => p.area >= minArea)
    .sort((a, b) => b.area - a.area)
    .slice(0, maxParts)
    .map((p) => {
      const region = componentMask(merged, labels, p.label);
      for (let i = 0; i < region.data.length; i++) region.data[i] &= ink.data[i];
      const mask = fillHoles(region);
      return { mask, bbox: p.bbox, score: Math.min(1, p.area / (ink.width * ink.height)) };
    });
}

// ---------- mask finishing (T080) ----------

/** 8-bit alpha (0 = outside, 255 = inside, values between = anti-aliased edge). */
export type AlphaMask = { width: number; height: number; alpha: Uint8Array };

/** Erosion by ~`radius` px: the dilation of the background, inverted. */
export async function erode(mask: Mask, radius: number): Promise<Mask> {
  const inv = { ...mask, data: mask.data.map((v) => (v ? 0 : 1)) };
  const grown = await dilate(inv, radius);
  return { ...mask, data: grown.data.map((v) => (v ? 0 : 1)) };
}

/** Pixel-wise OR of same-sized masks. */
export function unionMasks(masks: Mask[]): Mask {
  if (!masks.length) throw new Error("No masks to combine");
  const { width, height } = masks[0];
  const out = emptyMask(width, height);
  for (const m of masks) {
    if (m.width !== width || m.height !== height) throw new Error("Masks differ in size");
    for (let i = 0; i < out.data.length; i++) out.data[i] |= m.data[i];
  }
  return out;
}

/**
 * A box in (possibly fractional) pixels, clamped to a `width`×`height` image and widened to every
 * pixel it touches: floor the start, ceil the end. Null when nothing of it is on the image.
 */
export function clampBox([x0, y0, x1, y1]: BBox, width: number, height: number): BBox | null {
  const b: BBox = [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(width, Math.ceil(x1)), Math.min(height, Math.ceil(y1))];
  return b[0] < b[2] && b[1] < b[3] ? b : null;
}

/** A mask of a crop placed back into a `width`×`height` frame with its top-left at (`x0`, `y0`); the rest is empty (T134 detect). */
export function placeMask(mask: Mask, width: number, height: number, x0: number, y0: number): Mask {
  const out = emptyMask(width, height);
  const w = Math.min(mask.width, width - x0);
  if (w <= 0) return out;
  for (let y = 0; y < mask.height && y + y0 < height; y++) {
    out.data.set(mask.data.subarray(y * mask.width, y * mask.width + w), (y + y0) * width + x0);
  }
  return out;
}

/** Pixel-wise AND of a mask with a box (pixels outside the box are cleared). Same size as the input. */
export function clipToBox(mask: Mask, box: BBox): Mask {
  const out = emptyMask(mask.width, mask.height);
  const b = clampBox(box, mask.width, mask.height);
  if (!b) return out;
  for (let y = b[1]; y < b[3]; y++) out.data.set(mask.data.subarray(y * mask.width + b[0], y * mask.width + b[2]), y * mask.width + b[0]);
  return out;
}

/** Intersection over union of two same-sized masks (0 when both are empty). */
export function iou(a: Mask, b: Mask): number {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.data.length; i++) {
    const x = a.data[i], y = b.data[i];
    if (x && y) inter++;
    if (x || y) uni++;
  }
  return uni ? inter / uni : 0;
}

/**
 * Drops specks: a connected piece goes only when it is BOTH under `minFraction` of the largest
 * piece AND under an absolute floor (`minFrameFraction` of the frame, at least `minPx` pixels).
 * Small but real parts of a drawing (the dot of an "i", a star) stay.
 */
export function dropIslands(mask: Mask, minFraction = MIN_ISLAND_FRACTION, minFrameFraction = MIN_ISLAND_FRAME_FRACTION, minPx = MIN_ISLAND_PX): Mask {
  const { labels, parts } = components(mask);
  if (parts.length <= 1) return mask;
  const largest = parts.reduce((m, p) => Math.max(m, p.area), 0);
  const floor = Math.max(minPx, mask.width * mask.height * minFrameFraction);
  const keep = new Set(parts.filter((p) => p.area >= largest * minFraction || p.area >= floor).map((p) => p.label));
  const out = emptyMask(mask.width, mask.height);
  for (let i = 0; i < labels.length; i++) out.data[i] = keep.has(labels[i]) ? 1 : 0;
  return out;
}

/** Removes every connected piece of `mask` that contains one of `points` (pixel coordinates of the mask). */
export function removePiecesAt(mask: Mask, points: { x: number; y: number }[]): Mask {
  if (!points.length) return mask;
  const { labels } = components(mask);
  const drop = new Set<number>();
  for (const p of points) {
    const x = Math.max(0, Math.min(mask.width - 1, Math.floor(p.x))), y = Math.max(0, Math.min(mask.height - 1, Math.floor(p.y)));
    const l = labels[y * mask.width + x];
    if (l) drop.add(l);
  }
  if (!drop.size) return mask;
  const out = emptyMask(mask.width, mask.height);
  for (let i = 0; i < labels.length; i++) out.data[i] = labels[i] && !drop.has(labels[i]) ? 1 : 0;
  return out;
}

/** Nearest-neighbour resize of a binary mask. */
export async function resizeMask(mask: Mask, width: number, height: number): Promise<Mask> {
  if (mask.width === width && mask.height === height) return mask;
  const g = await greyRaw(maskSharp(mask).resize(width, height, { kernel: "nearest", fit: "fill" }));
  return fromGrey(g.data, g.width, g.height, 127);
}

/** Longest side the finishing steps run at (the SAM request size, so the close radius is in request pixels). */
export const FINISH_MAX_SIDE = 2048;
/** Morphological close radius at the working scale (bridges hairline gaps between SAM pieces). */
export const CLOSE_RADIUS_PX = 2;
/** A piece is a speck (dropped) when under this fraction of its part's main blob… */
export const MIN_ISLAND_FRACTION = 0.005;
/** …and also under this fraction of the frame (0.02 %)… */
export const MIN_ISLAND_FRAME_FRACTION = 0.0002;
/** …or under this many pixels, whichever floor is larger. */
export const MIN_ISLAND_PX = 64;

/**
 * Turns segmentation masks into a clean, anti-aliased alpha at `target` size.
 * Each part (one per chosen candidate or SAM object): fill holes, drop specks (under 0.5 % of its
 * main blob and under 0.02 % of the frame / 64 px). Then union the parts (so every combined piece is kept), close ≈ 2 px at request
 * scale, fill holes again, and resize with a linear kernel after a light blur so the edge is a
 * soft 0–255 ramp instead of a staircase. Swappable: the pipeline only depends on the signature.
 */
export async function finishMask(parts: Mask | Mask[], target: { width: number; height: number }): Promise<AlphaMask> {
  const list = Array.isArray(parts) ? parts : [parts];
  if (!list.length) throw new Error("No masks to finish");
  const { width, height } = list[0];
  const scale = Math.min(1, FINISH_MAX_SIDE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  const cleaned = await Promise.all(list.map(async (p) => dropIslands(fillHoles(await resizeMask(p, w, h)))));
  let m = unionMasks(cleaned);
  m = fillHoles(await erode(await dilate(m, CLOSE_RADIUS_PX), CLOSE_RADIUS_PX));
  const { data, info } = await maskSharp(m).blur(0.6)
    .resize(target.width, target.height, { kernel: "linear", fit: "fill" })
    .raw().toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * info.channels];
  return { width: info.width, height: info.height, alpha };
}

/** Binary view of an alpha (inside = alpha ≥ 128). */
export function alphaToMask(a: AlphaMask, threshold = 127): Mask {
  const data = new Uint8Array(a.width * a.height);
  for (let i = 0; i < data.length; i++) data[i] = a.alpha[i] > threshold ? 1 : 0;
  return { width: a.width, height: a.height, data };
}

/** Greyscale PNG of an alpha (white = inside). `maskFromPng` reads it back as a binary mask. */
export async function alphaToPng(a: AlphaMask): Promise<Buffer> {
  return sharp(Buffer.from(a.alpha), { raw: { width: a.width, height: a.height, channels: 1 } }).png().toBuffer();
}
