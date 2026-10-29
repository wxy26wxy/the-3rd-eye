/**
 * Binary mask utilities (row-major Uint8Array of 0/1). Pure image math on top of sharp;
 * no network. Used by the sticker pipeline, the SAM fallback and offline fixtures.
 */
import sharp from "sharp";
import type { Mask } from "@/lib/ai/types";

export type BBox = [number, number, number, number]; // x0, y0, x1 (exclusive), y1 (exclusive)

export function emptyMask(width: number, height: number): Mask {
  return { width, height, data: new Uint8Array(width * height) };
}

async function greyRaw(img: sharp.Sharp): Promise<{ data: Buffer; width: number; height: number }> {
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

export function maskSharp(mask: Mask): sharp.Sharp {
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
