/**
 * SAM 3.1 via the Responses API (stream: true), parsed with @meta-sam/parser.
 * findAll() returns every instance of a phrase; segment() takes a phrase, a box or points
 * (object-prompt text built with the package's buildObjectPrompt). When SAM returns nothing
 * (or the call fails) both fall back to a sharp threshold mask.
 * UNVERIFIED: request shape (input_image + input_text in one user message) until live.
 */
import "server-only";
import sharp from "sharp";
import {
  buildObjectPrompt, decodeMaskToRaster, decodeMaskToSVGPath, parseImageStream, recordsOfKind,
  type SegmentationMaskRecord,
} from "@meta-sam/parser";
import type { ImageRef, Mask, Segment, Segmenter, Trace } from "../types";
import { traced } from "../trace";
import { CALL_TIMEOUT_MS, MODELS, metaClient } from "./client";
import { callSignal } from "@/lib/deadline";
import { inputImage, userMessage } from "./responses";
import { loadImageRef, pngRef } from "@/lib/image/ref";
import { bboxOf, emptyMask, maskFromPng, maskSharp, thresholdSegments, type BBox } from "@/lib/image/mask";

const SAM_MAX_SIDE = 2048;
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

/** Places a SAM raster (H×W covering `bounds`) into a full-frame mask, scaling nearest-neighbour. */
export function placeRaster(rec: SegmentationMaskRecord, frameW: number, frameH: number): Mask {
  const raster = decodeMaskToRaster(rec.mask);
  const { width: rw, height: rh } = rec.mask;
  const { left, top, right, bottom } = rec.bounds;
  const bw = Math.max(1, right - left), bh = Math.max(1, bottom - top);
  const out = emptyMask(frameW, frameH);
  for (let y = Math.max(0, top); y < Math.min(frameH, bottom); y++) {
    const ry = Math.min(rh - 1, Math.floor(((y - top) * rh) / bh));
    for (let x = Math.max(0, left); x < Math.min(frameW, right); x++) {
      const rx = Math.min(rw - 1, Math.floor(((x - left) * rw) / bw));
      out.data[y * frameW + x] = raster[ry * rw + rx];
    }
  }
  return out;
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

async function scaleMask(mask: Mask, width: number, height: number): Promise<Mask> {
  if (mask.width === width && mask.height === height) return mask;
  const png = await maskSharp(mask).resize(width, height, { kernel: "nearest", fit: "fill" }).png().toBuffer();
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
        const small = placeRaster(rec, prep.sentW, prep.sentH);
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

  async segment(
    image: ImageRef,
    hint: { phrase?: string; points?: { x: number; y: number }[]; box?: [number, number, number, number] },
    opts: { trace: Trace },
  ): Promise<Segment | null> {
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
            ...(hint.box ? { box: { left: clampX(hint.box[0]), top: clampY(hint.box[1]), right: Math.max(clampX(hint.box[0]) + 1, clampX(hint.box[2])), bottom: Math.max(clampY(hint.box[1]) + 1, clampY(hint.box[3])) } } : {}),
            ...(hint.points?.length ? { points: hint.points.map((p) => ({ x: clampX(p.x), y: clampY(p.y) })) } : {}),
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

/** Chooses the fallback segment containing a hint point or overlapping the hint box the most. */
export function pickByHint(segs: Segment[], hint: { points?: { x: number; y: number }[]; box?: BBox }): Segment | null {
  if (!segs.length) return null;
  if (hint.points?.length) {
    const p = hint.points[0];
    const hit = segs.find((s) => s.mask.data[Math.round(p.y) * s.mask.width + Math.round(p.x)]);
    if (hit) return hit;
  }
  if (hint.box) {
    const [x0, y0, x1, y1] = hint.box;
    const overlap = (b: BBox) => Math.max(0, Math.min(x1, b[2]) - Math.max(x0, b[0])) * Math.max(0, Math.min(y1, b[3]) - Math.max(y0, b[1]));
    return [...segs].sort((a, b) => overlap(b.bbox) - overlap(a.bbox))[0];
  }
  return segs[0];
}
