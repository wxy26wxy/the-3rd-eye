/** T134: detection inside the frame (`detectInBox`) and `POST /artworks {detect:false}` (offline, mocked storage/DB/SAM). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { Mask } from "@/lib/ai/types";
import { emptyMask, maskFromAlpha, maskFromPng, placeMask } from "@/lib/image/mask";

const files = new Map<string, Buffer>();
const rows = new Map<string, Record<string, unknown>>();
const state = {
  findCalls: [] as { w: number; h: number }[], findOpts: [] as unknown[], segmentCalls: 0, rebuilt: [] as string[], products: [] as { id: string }[],
  crop: [] as { mask: Mask; bbox: [number, number, number, number]; score: number; svgPath: string }[],
  updates: [] as Record<string, unknown>[], reads: [] as string[],
};
let n = 0;
vi.mock("@/lib/storage", () => ({
  storage: () => ({
    read: async (p: string) => { state.reads.push(p); const b = files.get(p); if (!b) throw new Error(`missing ${p}`); return b; },
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
      findCandidates: async (img: { data?: Buffer; url?: string } | Buffer, opts: unknown) => {
        state.findOpts.push(opts);
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

import { changeRepeat, clipAlpha, createFromImage, detectInBox } from "@/lib/pipeline/artworks";

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
  state.findCalls = []; state.findOpts = []; state.segmentCalls = 0; state.rebuilt = []; state.products = []; state.crop = []; state.updates = []; state.reads = [];
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
    expect(state.findOpts[0]).toMatchObject({ maxCoverage: 1, dropContainers: false }); // a tight frame keeps a frame-filling piece
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

  it("nothing inside the frame, or a box outside the image → 422 no_drawing_found; the previous candidates and cut stay, only lastError is set", async () => {
    const previous = [{ id: "k1", bbox: [0, 0, 5, 5], score: 1, thumbUrl: "t", maskUrl: "m" }];
    const artwork = await photoRow({ candidates: previous, cleanedUrl: "old-cut.png", status: "ready" });
    await expect(detectInBox(artwork, [0, 0, 100, 100])).rejects.toMatchObject({ status: 422, code: "no_drawing_found" });
    expect(state.updates).toEqual([{ lastError: "no_drawing_found" }]);
    await expect(detectInBox(artwork, [500, 400, 600, 500])).rejects.toMatchObject({ status: 422, code: "no_drawing_found" });
    expect(state.updates).toEqual([{ lastError: "no_drawing_found" }, { lastError: "no_drawing_found" }]);
    expect(rows.get("a1")).toMatchObject({ candidates: previous, cleanedUrl: "old-cut.png", status: "ready" });
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

  it("the default path keeps the whole-photo rules: no maxCoverage / dropContainers override (T143)", async () => {
    files.set("upload.png", await sharp({ create: { width: 1200, height: 1000, channels: 3, background: "#ffffff" } }).png().toBuffer());
    await createFromImage("c1", { source: "photo", imageUrl: "creators/c1/photo/u.jpg", product: "sticker" }).catch(() => undefined);
    expect(state.findOpts).toHaveLength(1);
    expect(state.findOpts[0]).not.toHaveProperty("maxCoverage");
    expect(state.findOpts[0]).not.toHaveProperty("dropContainers");
  });
});

describe("createFromImage framed (T143, round 4: the upload is the creator's crop)", () => {
  it("detects on the whole picture with the frame rules, cuts the largest piece, answers details, reads the original once", async () => {
    files.set("upload.png", await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#ffffff" } }).png().toBuffer());
    state.crop = [
      seg(rect(1200, 900, 10, 10, 40, 40), [10, 10, 40, 40]),
      seg(rect(1200, 900, 0, 0, 1200, 900), [0, 0, 1200, 900]), // fills the crop edge to edge: kept
    ];
    const out = await createFromImage("c1", { source: "photo", imageUrl: "creators/c1/photo/u.jpg", product: "sticker", framed: true });
    expect(state.findCalls).toEqual([{ w: 1200, h: 900 }]);
    expect(state.findOpts[0]).toMatchObject({ maxCoverage: 1, dropContainers: false });
    expect(state.reads).toEqual([]); // the stored original is passed on, not read back
    expect(out.imageSize).toEqual({ w: 1200, h: 900 });
    expect(out.candidates.map((c) => c.bbox)).toEqual([[10, 10, 40, 40], [0, 0, 1200, 900]]); // T153: the frame-filling mask goes last
    const row = out.artwork as unknown as { cleanedUrl: string; status: string };
    expect(row.status).toBe("ready");
    expect(row.cleanedUrl).toBeTruthy();
    expect(out.details).toEqual({ failedProductIds: [], unpublishedProductIds: [] });
  });

  it("an EXIF-rotated upload is detected upright: imageSize and the frame are the rotated picture's", async () => {
    // Stored 1200×900 landscape with orientation 6 (rotate 90° clockwise): the upright picture is 900×1200.
    files.set("upload.png", await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#ffffff" } }).withMetadata({ orientation: 6 }).jpeg().toBuffer());
    state.crop = [seg(rect(900, 1200, 100, 100, 800, 1100), [100, 100, 800, 1100])];
    const out = await createFromImage("c1", { source: "photo", imageUrl: "creators/c1/photo/u.jpg", product: "sticker", framed: true });
    expect(out.imageSize).toEqual({ w: 900, h: 1200 });
    expect(state.findCalls).toEqual([{ w: 900, h: 1200 }]);
    expect(out.candidates.map((c) => c.bbox)).toEqual([[100, 100, 800, 1100]]);
    const stored = await maskFromPng(files.get(out.candidates[0].maskUrl)!);
    expect([stored.width, stored.height]).toEqual([900, 1200]);
  });

  it("nothing found → 422 no_drawing_found with the new row's artworkId", async () => {
    files.set("upload.png", await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#ffffff" } }).png().toBuffer());
    const err = await createFromImage("c1", { source: "photo", imageUrl: "creators/c1/photo/u.jpg", product: "tote", framed: true }).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 422, code: "no_drawing_found" });
    const id = (err as { details?: { artworkId?: string } }).details?.artworkId;
    expect(id && rows.get(id)).toMatchObject({ candidates: [], lastError: "no_drawing_found" });
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

describe("changeRepeat (T134 fix round m1)", () => {
  it("describes a stored change child that has no description yet, and keeps an existing one", async () => {
    await photoRow();
    rows.set("ch1", { id: "ch1", originalUrl: "orig.png", changeInstruction: "purple", altText: null });
    const out = await changeRepeat({ id: "ch1", originalUrl: "orig.png", changeInstruction: "purple", altText: null } as never);
    expect(out.description.alt_text).toBe("Art");
    expect(state.updates.at(-1)).toMatchObject({ altText: "Art", spokenDescription: "Art" });
    const n = state.updates.length;
    const kept = await changeRepeat({ id: "ch1", originalUrl: "orig.png", altText: "Before", spokenDescription: "Said.", differencesFromPrompt: null } as never);
    expect(kept.description).toMatchObject({ alt_text: "Before", spoken: "Said." });
    expect(state.updates.length).toBe(n);
  });
});
