/**
 * SAM 3.1 via the Responses API (stream: true), parsed with @meta-sam/parser.
 * findAll() returns every instance of a phrase; findCandidates() runs SAM_PHRASES in parallel
 * (drawings and physical objects) and merges the results; segment() takes a box and/or labelled
 * points (object-prompt text built with the package's buildObjectPrompt). When SAM returns
 * nothing (or the call fails) they fall back to a sharp threshold mask.
 * Verified live: phrase requests 2026-10-28, box and positive/negative point prompts 2026-10-29
 * (recordings in test/fixtures/segment/).
 */
import "server-only";
import sharp from "sharp";
import {
  buildObjectPrompt, decodeMaskToRaster, decodeMaskToSVGPath, parseImageStream, recordsOfKind,
  type SegmentationMaskRecord,
} from "@meta-sam/parser";
import type { CandidateSearch, FindCandidatesOpts, ImageRef, Mask, Segment, SegmentHint, Segmenter, Trace } from "../types";
import { traced } from "../trace";
import { CALL_TIMEOUT_MS, MODELS, metaClient } from "./client";
import { callSignal } from "@/lib/deadline";
import { inputImage, userMessage } from "./responses";
import { loadImageRef, pngRef } from "@/lib/image/ref";
import { area, bboxOf, emptyMask, maskFromPng, maskSharp, thresholdSegments, type BBox } from "@/lib/image/mask";

const SAM_MAX_SIDE = 2048;
/**
 * Phrases a photo is searched with (one SAM call each, in parallel): drawings on paper and
 * physical crafts, toys and things. Live check 2026-10-29: "object" alone found nothing on a photo
 * of a knitted bear on a wooden table (nor did "item" or "thing"), while "handmade object" found
 * the bear (0.91) and both a wallet and a clay figure on a desk (0.81 / 0.75). See docs/decisions.md.
 */
export const SAM_PHRASES = ["drawing", "handmade object"] as const;
/** SAM results scoring under this are dropped, unless nothing scores higher. */
export const MIN_CANDIDATE_SCORE = 0.1;
/** Two results overlapping more than this are the same thing; the higher score is kept. */
export const DEDUPE_IOU = 0.8;
/** Results covering more than this share of the frame are the background (paper, table) and are dropped. */
export const MAX_FRAME_COVERAGE = 0.95;
export const MAX_CANDIDATES = 6;

/** IoU computed only inside the boxes' overlap (areas precomputed), so it stays fast on full-size masks. */
function segIou(a: Segment, aArea: number, b: Segment, bArea: number): number {
  const x0 = Math.max(a.bbox[0], b.bbox[0]), y0 = Math.max(a.bbox[1], b.bbox[1]);
  const x1 = Math.min(a.bbox[2], b.bbox[2]), y1 = Math.min(a.bbox[3], b.bbox[3]);
  if (x1 <= x0 || y1 <= y0) return 0;
  const w = a.mask.width;
  let inter = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * w + x; if (a.mask.data[i] && b.mask.data[i]) inter++; }
  const uni = aArea + bArea - inter;
  return uni ? inter / uni : 0;
}

/** A result covering more than this share of the frame that contains another result is the paper or table around it. */
export const MAX_CONTAINER_COVERAGE = 0.4;

const bboxContains = (a: BBox, b: BBox) => a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];

/**
 * Merges results from several phrases: drops frame-filling ones, sorts by score, drops any that
 * overlaps an already kept one by IoU > `iouMax`, drops a "container" (covers more than 40 % of
 * the frame, its box contains another result's box AND it scores lower than that result: the
 * sheet of paper or the table around a drawing; a confident close-up of a toy is kept), caps at `max`.
 */
export function dedupeSegmentsInfo(segs: Segment[], opts: { max?: number; iouMax?: number; maxCoverage?: number; dropContainers?: boolean } = {}): CandidateSearch {
  const max = opts.max ?? MAX_CANDIDATES, iouMax = opts.iouMax ?? DEDUPE_IOU, maxCoverage = opts.maxCoverage ?? MAX_FRAME_COVERAGE;
  const sized = segs.map((s) => ({ s, a: area(s.mask) }))
    .filter(({ s, a }) => a > 0 && a <= s.mask.width * s.mask.height * maxCoverage)
    .sort((x, y) => y.s.score - x.s.score);
  const kept: typeof sized = [];
  for (const c of sized) {
    if (kept.every((k) => segIou(c.s, c.a, k.s, k.a) <= iouMax)) kept.push(c);
  }
  const frame = (k: (typeof kept)[number]) => k.s.mask.width * k.s.mask.height;
  const isContainer = (k: (typeof kept)[number]) =>
    k.a > frame(k) * MAX_CONTAINER_COVERAGE && kept.some((o) => o !== k && o.s.score > k.s.score && bboxContains(k.s.bbox, o.s.bbox));
  const rest = opts.dropContainers === false ? kept : kept.filter((k) => !isContainer(k));
  return { segments: rest.slice(0, max).map((k) => k.s), droppedContainer: rest.length < kept.length };
}

export function dedupeSegments(segs: Segment[], opts: { max?: number; iouMax?: number; maxCoverage?: number } = {}): Segment[] {
  return dedupeSegmentsInfo(segs, opts).segments;
}

type StreamEvent = { type: string; [k: string]: unknown };
export type SamStreamFn = (body: Record<string, unknown>) => Promise<AsyncIterable<StreamEvent>>;

const defaultStream: SamStreamFn = async (body) =>
  (await metaClient().responses.create({ ...body, stream: true } as never, { signal: callSignal(CALL_TIMEOUT_MS) })) as unknown as AsyncIterable<StreamEvent>;

/**
 * Forwards events until `response.completed`, then stops reading. If the lane was never
 * finalized (the API may skip `response.output_text.done`), injects a synthetic done event
 * with the accumulated text so the parser can complete.
 */
export async function* untilCompleted(source: AsyncIterable<StreamEvent>): AsyncGenerator<StreamEvent> {
  let text = "";
  let lane: { item_id: unknown; output_index: unknown; content_index: unknown } | null = null;
  let finalized = false;
  for await (const ev of source) {
    if (ev.type === "response.output_text.delta") {
      lane ??= { item_id: ev.item_id, output_index: ev.output_index, content_index: ev.content_index };
      text += String(ev.delta ?? "");
    }
    if (ev.type === "response.output_text.done" || ev.type === "response.content_part.done") finalized = true;
    if (ev.type === "response.completed" || ev.type === "response.incomplete") {
      if (lane && !finalized) yield { type: "response.output_text.done", ...lane, text };
      yield ev;
      return;
    }
    yield ev;
  }
}

export type RasterBounds = { left: number; top: number; right: number; bottom: number };

/** Blur of a coarse SAM raster after its bilinear upsampling, in raster steps (σ = this × step; T134 fix round). */
export const RASTER_EDGE_SIGMA = 0.5;

/**
 * Places a SAM raster (rh×rw covering `bounds`) into a full-frame mask. When the raster is coarser
 * than its bounds (one raster pixel spans `step` > 1 frame pixels) it is sampled bilinearly as grey,
 * blurred by RASTER_EDGE_SIGMA × step and thresholded at 127, so its blocks become the smooth outline
 * they approximate instead of terraces (T134, ruling 4). A raster at its bounds' resolution is copied as is.
 */
export async function placeRasterData(raster: Uint8Array, rw: number, rh: number, bounds: RasterBounds, frameW: number, frameH: number): Promise<Mask> {
  const { left, top, right, bottom } = bounds;
  const bw = Math.max(1, right - left), bh = Math.max(1, bottom - top);
  const out = emptyMask(frameW, frameH);
  const step = Math.max(bw / rw, bh / rh);
  let grid: Uint8Array;
  if (rw === bw && rh === bh) {
    grid = raster;
  } else {
    const grey = Buffer.alloc(rw * rh);
    for (let i = 0; i < grey.length; i++) grey[i] = raster[i] ? 255 : 0;
    let img = sharp(grey, { raw: { width: rw, height: rh, channels: 1 } }).resize(bw, bh, { kernel: "linear", fit: "fill" });
    const up = await img.raw().toBuffer({ resolveWithObject: true });
    img = sharp(up.data, { raw: { width: up.info.width, height: up.info.height, channels: up.info.channels } });
    if (step > 1.05) img = img.blur(Math.max(0.3, RASTER_EDGE_SIGMA * step));
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    grid = new Uint8Array(bw * bh);
    for (let i = 0; i < grid.length; i++) grid[i] = data[i * info.channels] > 127 ? 1 : 0;
  }
  const gw = rw === bw && rh === bh ? rw : bw;
  for (let y = Math.max(0, top); y < Math.min(frameH, bottom); y++) {
    for (let x = Math.max(0, left); x < Math.min(frameW, right); x++) out.data[y * frameW + x] = grid[(y - top) * gw + (x - left)];
  }
  return out;
}

/** Places a SAM mask record into a full-frame mask (see placeRasterData). */
export async function placeRaster(rec: SegmentationMaskRecord, frameW: number, frameH: number): Promise<Mask> {
  return placeRasterData(decodeMaskToRaster(rec.mask), rec.mask.width, rec.mask.height, rec.bounds, frameW, frameH);
}

/** Shifts and scales the numbers of a polygonal M/L/Z path. */
export function transformPath(d: string, dx: number, dy: number, sx = 1, sy = 1): string {
  let i = 0;
  return d.replace(/-?\d+(\.\d+)?/g, (n) => {
    const v = Number(n);
    const out = i++ % 2 === 0 ? v * sx + dx : v * sy + dy;
    return String(Math.round(out * 100) / 100);
  });
}

/** Request-size mask → original size: linear kernel, thresholded at 127 (T134: no nearest-neighbour blocks). */
async function scaleMask(mask: Mask, width: number, height: number): Promise<Mask> {
  if (mask.width === width && mask.height === height) return mask;
  const png = await maskSharp(mask).resize(width, height, { kernel: "linear", fit: "fill" }).png().toBuffer();
  return maskFromPng(png);
}

export class MetaSegmenter implements Segmenter {
  constructor(private stream: SamStreamFn = defaultStream) {}

  /** Prepares the image (downscaled for the request) and remembers the original size. */
  private async prepare(image: ImageRef) {
    const original = await sharp(await loadImageRef(image)).rotate().png().toBuffer();
    const meta = await sharp(original).metadata();
    const width = meta.width ?? 0, height = meta.height ?? 0;
    const scale = Math.min(1, SAM_MAX_SIDE / Math.max(width, height));
    const sent = scale < 1 ? await sharp(original).resize(Math.round(width * scale), Math.round(height * scale)).png().toBuffer() : original;
    const sm = await sharp(sent).metadata();
    return { original, width, height, sent, sentW: sm.width ?? width, sentH: sm.height ?? height };
  }

  private async run(prep: Awaited<ReturnType<MetaSegmenter["prepare"]>>, text: string, trace: Trace): Promise<Segment[]> {
    const body = {
      model: MODELS.sam,
      input: [userMessage([inputImage(pngRef(prep.sent)), { type: "input_text", text }])],
      metadata: { include_confidence: "true" },
    };
    return traced("segment", "meta", MODELS.sam, body, async () => {
      const parsed = parseImageStream(untilCompleted(await this.stream(body)));
      const result = await parsed.finalResult;
      const boxes = recordsOfKind(result.records, "box");
      const latest = new Map<string, SegmentationMaskRecord>();
      for (const m of recordsOfKind(result.records, "mask")) latest.set(m.identity, m);
      const segs: Segment[] = [];
      for (const rec of latest.values()) {
        const small = await placeRaster(rec, prep.sentW, prep.sentH);
        const mask = await scaleMask(small, prep.width, prep.height);
        const bbox = bboxOf(mask);
        if (!bbox) continue;
        const sx = prep.width / prep.sentW, sy = prep.height / prep.sentH;
        const box = boxes.find((b) => b.objectId === rec.objectId);
        segs.push({
          mask, bbox,
          score: rec.confidence ?? box?.confidence ?? 1,
          svgPath: transformPath(decodeMaskToSVGPath(rec.mask), rec.bounds.left * sx, rec.bounds.top * sy,
            ((rec.bounds.right - rec.bounds.left) / rec.mask.width) * sx, ((rec.bounds.bottom - rec.bounds.top) / rec.mask.height) * sy),
        });
      }
      return segs.sort((a, b) => b.score - a.score);
    }, trace);
  }

  private async fallback(prep: { original: Buffer }): Promise<Segment[]> {
    return (await thresholdSegments(prep.original)).map((s) => ({ ...s, svgPath: "" }));
  }

  async findAll(image: ImageRef, phrase: string, opts: { trace: Trace }): Promise<Segment[]> {
    const prep = await this.prepare(image);
    let segs: Segment[] = [];
    try {
      segs = await this.run(prep, phrase, opts.trace);
    } catch (err) {
      console.warn("[sam] findAll failed, using threshold fallback:", err instanceof Error ? err.message : err);
    }
    return segs.length ? segs : this.fallback(prep);
  }

  async findCandidates(image: ImageRef, opts: FindCandidatesOpts): Promise<CandidateSearch> {
    const prep = await this.prepare(image);
    const phrases = opts.phrases?.length ? opts.phrases : SAM_PHRASES;
    const runs = await Promise.allSettled(phrases.map((p) => this.run(prep, p, opts.trace)));
    const all: Segment[] = [];
    runs.forEach((r, i) => {
      if (r.status === "fulfilled") all.push(...r.value);
      else console.warn(`[sam] findCandidates "${phrases[i]}" failed:`, r.reason instanceof Error ? r.reason.message : r.reason);
    });
    const confident = all.filter((s) => s.score >= MIN_CANDIDATE_SCORE);
    const rules = { max: opts.max, maxCoverage: opts.maxCoverage, dropContainers: opts.dropContainers };
    const found = dedupeSegmentsInfo(confident.length ? confident : all, rules);
    return found.segments.length ? found : dedupeSegmentsInfo(await this.fallback(prep), rules);
  }

  async segment(image: ImageRef, hint: SegmentHint, opts: { trace: Trace }): Promise<Segment | null> {
    if (hint.phrase && !hint.points?.length && !hint.box) return (await this.findAll(image, hint.phrase, opts))[0] ?? null;
    const prep = await this.prepare(image);
    const sx = prep.sentW / prep.width, sy = prep.sentH / prep.height;
    const clampX = (v: number) => Math.max(0, Math.min(prep.sentW - 1, Math.floor(v * sx)));
    const clampY = (v: number) => Math.max(0, Math.min(prep.sentH - 1, Math.floor(v * sy)));
    let segs: Segment[] = [];
    try {
      const text = buildObjectPrompt({
        size: { width: prep.sentW, height: prep.sentH },
        objects: [{
          id: 1,
          prompts: [{
            ...(hint.box ? { box: objectBox(hint.box, sx, sy, prep.sentW, prep.sentH) } : {}),
            ...(hint.points?.length ? {
              points: hint.points.map((p) => ({ x: clampX(p.x), y: clampY(p.y), ...(p.label === "negative" ? { label: "negative" as const } : {}) })),
            } : {}),
          }],
        }],
      });
      segs = await this.run(prep, text, opts.trace);
    } catch (err) {
      console.warn("[sam] segment failed, using threshold fallback:", err instanceof Error ? err.message : err);
    }
    if (segs.length) return segs[0];
    return pickByHint(await this.fallback(prep), hint);
  }
}

/** Half-open box in request pixels: left/top floored, right/bottom ceiled (an edge-reaching box keeps the last column/row), ≥ 1 px. */
export function objectBox(box: [number, number, number, number], sx: number, sy: number, w: number, h: number) {
  const left = Math.max(0, Math.min(w - 1, Math.floor(box[0] * sx))), top = Math.max(0, Math.min(h - 1, Math.floor(box[1] * sy)));
  const right = Math.min(w, Math.max(left + 1, Math.ceil(box[2] * sx))), bottom = Math.min(h, Math.max(top + 1, Math.ceil(box[3] * sy)));
  return { left, top, right, bottom };
}

/** Chooses the fallback segment containing a positive hint point (and no negative one), else the one overlapping the hint box the most. */
export function pickByHint(segs: Segment[], hint: SegmentHint): Segment | null {
  if (!segs.length) return null;
  const at = (s: Segment, p: { x: number; y: number }) => s.mask.data[Math.round(p.y) * s.mask.width + Math.round(p.x)];
  const positive = (hint.points ?? []).filter((p) => p.label !== "negative");
  const negative = (hint.points ?? []).filter((p) => p.label === "negative");
  const allowed = segs.filter((s) => !negative.some((p) => at(s, p)));
  if (positive.length) {
    const hit = allowed.find((s) => positive.some((p) => at(s, p)));
    if (hit) return hit;
    if (!hint.box) return null; // no fallback piece under the creator's taps: better nothing than a random blob
  }
  if (hint.box) {
    const [x0, y0, x1, y1] = hint.box;
    const overlap = (b: BBox) => Math.max(0, Math.min(x1, b[2]) - Math.max(x0, b[0])) * Math.max(0, Math.min(y1, b[3]) - Math.max(y0, b[1]));
    const pool = allowed.length ? allowed : segs;
    return [...pool].sort((a, b) => overlap(b.bbox) - overlap(a.bbox))[0];
  }
  return allowed[0] ?? null;
}
