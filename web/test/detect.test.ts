/** T134: detection inside the frame (`detectInBox`) and `POST /artworks {detect:false}` (offline, mocked storage/DB/SAM). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { Mask } from "@/lib/ai/types";
import { emptyMask, maskFromAlpha, maskFromPng, placeMask } from "@/lib/image/mask";

const files = new Map<string, Buffer>();
const rows = new Map<string, Record<string, unknown>>();
const state = {
  findCalls: [] as { w: number; h: number }[], segmentCalls: 0, rebuilt: [] as string[], products: [] as { id: string }[],
  crop: [] as { mask: Mask; bbox: [number, number, number, number]; score: number; svgPath: string }[],
  updates: [] as Record<string, unknown>[],
};
let n = 0;
vi.mock("@/lib/storage", () => ({
  storage: () => ({
    read: async (p: string) => { const b = files.get(p); if (!b) throw new Error(`missing ${p}`); return b; },
    putPublic: async (p: string, data: Buffer) => { files.set(p, data); return { pathname: p, url: p }; },
    putPrivate: async (p: string, data: Buffer) => { files.set(p, data); return { pathname: p, url: p }; },
    delete: async () => undefined,
  }),
  creatorPath: (_c: string, kind: string, ext: string) => `creators/c1/${kind}/${++n}.${ext}`,
  clientUploadPath: () => "creators/c1/photo/u.jpg", readClientUpload: async () => files.get("upload.png")!,
}));
vi.mock("@/lib/db/queries", () => ({
  updateArtwork: async (id: string, patch: Record<string, unknown>) => {
    state.updates.push(patch);
    const row = { ...(rows.get(id) ?? { id }), ...patch };
    rows.set(id, row);
    return row;
  },
  insertArtwork: async (v: { id: string }) => { rows.set(v.id, v); return v; },
  listProductsForArtwork: async () => state.products,
}));
vi.mock("@/lib/pipeline/products", () => ({
  rebuildProductFiles: async (id: string) => { state.rebuilt.push(id); return { product: { id }, printOk: true, unpublished: false }; },
}));
vi.mock("@/lib/ai/registry", () => ({
  ai: async () => ({
    segmenter: {
      segment: async () => { state.segmentCalls++; return null; },
      findCandidates: async (img: { data?: Buffer; url?: string } | Buffer) => {
        const buf = Buffer.isBuffer(img) ? img : (img as { data: Buffer }).data;
        const meta = await sharp(buf).metadata();
        state.findCalls.push({ w: meta.width!, h: meta.height! });
        return { segments: state.crop, droppedContainer: false };
      },
    },
    describer: { describe: async () => ({ alt_text: "Art", spoken: "Art", dominant_colors: [], subject: "art", differences_from_prompt: "" }) },
  }),
}));
vi.mock("@/lib/image/ref", () => ({ pngRef: (b: Buffer) => ({ data: b }) }));

import { clipAlpha, createFromImage, detectInBox } from "@/lib/pipeline/artworks";

const W = 400, H = 300;
function rect(w: number, h: number, x0: number, y0: number, x1: number, y1: number): Mask {
  const m = emptyMask(w, h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m.data[y * w + x] = 1;
  return m;
}
const seg = (m: Mask, bbox: [number, number, number, number], score = 0.9) => ({ mask: m, bbox, score, svgPath: "" });

async function photoRow(extra: Record<string, unknown> = {}) {
  files.set("orig.png", await sharp({ create: { width: W, height: H, channels: 3, background: "#cc3344" } }).png().toBuffer());
  const row = { id: "a1", creatorId: "c1", source: "photo", originalUrl: "orig.png", shapedPrompt: null, changeInstruction: null, candidates: [], shapingTrace: { imageSize: { w: W, h: H } }, ...extra };
  rows.set("a1", row);
  return row as never;
}

beforeEach(() => {
  state.findCalls = []; state.segmentCalls = 0; state.rebuilt = []; state.products = []; state.crop = []; state.updates = [];
});

describe("placeMask", () => {
  it("puts a crop's mask back at its offset", () => {
    const m = placeMask(rect(10, 10, 0, 0, 5, 5), 30, 20, 20, 10);
    expect(m.width).toBe(30);
    expect(m.data[10 * 30 + 20]).toBe(1);
    expect(m.data[14 * 30 + 24]).toBe(1);
    expect(m.data[15 * 30 + 25]).toBe(0);
    expect(m.data[0]).toBe(0);
  });
});

describe("detectInBox", () => {
  it("runs SAM on the crop only, places the masks at the frame offset, stores them largest first and cuts the largest clipped to the box", async () => {
    const artwork = await photoRow();
    state.products = [{ id: "p1" }];
    // Crop of [100, 50, 300, 250] is 200×200; a small piece and a bigger one inside it.
    state.crop = [seg(rect(200, 200, 10, 10, 40, 40), [10, 10, 40, 40], 0.95), seg(rect(200, 200, 60, 60, 160, 140), [60, 60, 160, 140], 0.8)];
    const out = await detectInBox(artwork, [100, 50, 300, 250]);
    expect(state.findCalls).toEqual([{ w: 200, h: 200 }]);
    expect(state.segmentCalls).toBe(0);
    expect(out.imageSize).toEqual({ w: W, h: H });
    expect(out.candidates.map((c) => c.bbox)).toEqual([[160, 110, 260, 190], [110, 60, 140, 90]]);
    const stored = await maskFromPng(files.get(out.candidates[0].maskUrl)!);
    expect([stored.width, stored.height]).toEqual([W, H]);
    expect(stored.data[150 * W + 200]).toBe(1); // inside the bigger piece, in photo pixels
    expect(stored.data[150 * W + 100]).toBe(0);
    const row = out.artwork as unknown as { cleanedUrl: string; status: string };
    expect(row.status).toBe("ready");
    const meta = await sharp(files.get(row.cleanedUrl)!).metadata();
    expect(meta.width! / meta.height!).toBeCloseTo(100 / 80, 1);
    expect(state.rebuilt).toEqual(["p1"]);
  });

  it("a box past the image is clamped before the crop", async () => {
    const artwork = await photoRow();
    state.crop = [seg(rect(150, 100, 0, 0, 50, 50), [0, 0, 50, 50])];
    const out = await detectInBox(artwork, [250, 200, 9999, 9999]);
    expect(state.findCalls).toEqual([{ w: 150, h: 100 }]);
    expect(out.candidates[0].bbox).toEqual([250, 200, 300, 250]);
  });

  it("nothing inside the frame → 422 no_drawing_found, candidates cleared, lastError set", async () => {
    const artwork = await photoRow();
    await expect(detectInBox(artwork, [0, 0, 100, 100])).rejects.toMatchObject({ status: 422, code: "no_drawing_found" });
    expect(state.updates.at(-1)).toEqual({ candidates: [], lastError: "no_drawing_found" });
  });

  it("a change result or a generated row → 409 not_a_photo, no SAM call", async () => {
    await expect(detectInBox(await photoRow({ changeInstruction: "purple" }), [0, 0, 10, 10])).rejects.toMatchObject({ status: 409, code: "not_a_photo" });
    await expect(detectInBox(await photoRow({ source: "text2image" }), [0, 0, 10, 10])).rejects.toMatchObject({ status: 409, code: "not_a_photo" });
    expect(state.findCalls).toHaveLength(0);
  });

  it("the cut never reaches past the frame", async () => {
    const artwork = await photoRow();
    state.crop = [seg(rect(100, 100, 0, 0, 100, 100), [0, 0, 100, 100])]; // fills the crop up to its edges
    const out = await detectInBox(artwork, [150, 100, 250, 200]);
    const alpha = await maskFromAlpha(files.get((out.artwork as unknown as { cleanedUrl: string }).cleanedUrl)!);
    // the cleaned PNG is trimmed to the clipped cut: at most the frame (×2 upscale) plus nothing outside
    expect(alpha.width).toBeLessThanOrEqual(200);
    expect(alpha.height).toBeLessThanOrEqual(200);
  });
});

describe("createFromImage detect:false", () => {
  it("stores the photo, answers candidates [] and imageSize, and makes no SAM call", async () => {
    files.set("upload.png", await sharp({ create: { width: 1200, height: 1000, channels: 3, background: "#ffffff" } }).png().toBuffer());
    state.crop = [seg(rect(1200, 1000, 0, 0, 10, 10), [0, 0, 10, 10])];
    const out = await createFromImage("c1", { source: "photo", imageUrl: "creators/c1/photo/u.jpg", product: "sticker", detect: false });
    expect(state.findCalls).toHaveLength(0);
    expect(out.candidates).toEqual([]);
    expect(out.imageSize).toEqual({ w: 1200, h: 1000 });
    expect((out.artwork as unknown as { status: string; candidates: unknown[] }).status).toBe("draft");
    expect((out.artwork as unknown as { candidates: unknown[] }).candidates).toEqual([]);
  });

  it("without detect (default true) SAM still runs on the whole photo", async () => {
    files.set("upload.png", await sharp({ create: { width: 1200, height: 1000, channels: 3, background: "#ffffff" } }).png().toBuffer());
    await expect(createFromImage("c1", { source: "photo", imageUrl: "creators/c1/photo/u.jpg", product: "sticker" })).rejects.toMatchObject({ code: "no_drawing_found" });
    expect(state.findCalls).toEqual([{ w: 1200, h: 1000 }]);
  });
});

describe("clipAlpha (T134: 1 px feather inside the frame)", () => {
  it("clears outside the box and halves the alpha on the box's edge pixels at k = 1; k = 2 feathers over 2 px", () => {
    const a = { width: 10, height: 10, alpha: new Uint8Array(100).fill(255) };
    clipAlpha(a, [2, 2, 8, 8], 1);
    expect(a.alpha[1 * 10 + 5]).toBe(0);
    expect(a.alpha[2 * 10 + 5]).toBe(128);
    expect(a.alpha[3 * 10 + 5]).toBe(255);
    expect(a.alpha[7 * 10 + 5]).toBe(128);
    const b = { width: 20, height: 20, alpha: new Uint8Array(400).fill(255) };
    clipAlpha(b, [2, 2, 8, 8], 2); // alpha at ×2: box 4..16
    expect(b.alpha[10 * 20 + 3]).toBe(0);
    expect(b.alpha[10 * 20 + 4]).toBe(64);
    expect(b.alpha[10 * 20 + 5]).toBe(191);
    expect(b.alpha[10 * 20 + 6]).toBe(255);
  });
});
