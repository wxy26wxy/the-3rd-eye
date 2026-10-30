import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { Mask } from "@/lib/ai/types";
import { emptyMask, maskFromAlpha, maskToPng } from "@/lib/image/mask";
import { CleanupBody } from "@/lib/api/artwork-schemas";

const files = new Map<string, Buffer>();
const rows = new Map<string, Record<string, unknown>>();
const state = {
  updates: [] as Record<string, unknown>[], segmentCalls: [] as unknown[], rebuilt: [] as string[],
  products: [] as { id: string }[], droppedContainer: false, failRebuild: new Set<string>(), unpublish: new Set<string>(), described: 0,
  candidatesResult: [] as { mask: Mask; bbox: [number, number, number, number]; score: number; svgPath: string }[],
  segmentResult: null as null | { mask: Mask; bbox: [number, number, number, number]; score: number; svgPath: string },
  uploadPath: "creators/c1/photo/u.jpg", deleted: [] as string[],
};
let n = 0;
vi.mock("@/lib/storage", () => ({
  storage: () => ({
    read: async (p: string) => { const b = files.get(p); if (!b) throw new Error(`missing ${p}`); return b; },
    putPublic: async (p: string, data: Buffer) => { files.set(p, data); return { pathname: p, url: p }; },
    putPrivate: async (p: string, data: Buffer) => { files.set(p, data); return { pathname: p, url: p }; },
    delete: async (p: string) => { state.deleted.push(p); },
  }),
  creatorPath: (_c: string, kind: string, ext: string) => `creators/c1/${kind}/${++n}.${ext}`,
  clientUploadPath: () => state.uploadPath, readClientUpload: async () => files.get("orig.png")!,
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
  rebuildProductFiles: async (id: string) => {
    state.rebuilt.push(id);
    if (state.failRebuild.has(id)) throw new Error("compose timed out");
    return { product: { id }, printOk: !state.unpublish.has(id), unpublished: state.unpublish.has(id) };
  },
}));
vi.mock("@/lib/ai/registry", () => ({
  ai: async () => ({
    segmenter: {
      segment: async (_img: unknown, hint: unknown) => { state.segmentCalls.push(hint); return state.segmentResult; },
      findCandidates: async () => ({ segments: state.candidatesResult, droppedContainer: state.droppedContainer }),
    },
    describer: { describe: async () => (state.described++, { alt_text: "Art", spoken: "Art", dominant_colors: [], subject: "art", differences_from_prompt: "" }) },
  }),
}));

import { cleanupArtwork, createFromImage } from "@/lib/pipeline/artworks";

const W = 400, H = 300;
function rect(x0: number, y0: number, x1: number, y1: number): Mask {
  const m = emptyMask(W, H);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m.data[y * W + x] = 1;
  return m;
}

async function setup() {
  files.clear();
  files.set("orig.png", await sharp({ create: { width: W, height: H, channels: 3, background: "#cc3344" } }).png().toBuffer());
  files.set("m1.png", await maskToPng(rect(20, 20, 120, 120)));
  files.set("m2.png", await maskToPng(rect(250, 150, 380, 280)));
  return {
    id: "a1", creatorId: "c1", source: "photo", originalUrl: "orig.png", shapedPrompt: null,
    candidates: [
      { id: "k1", bbox: [20, 20, 120, 120], score: 0.9, thumbUrl: "", maskUrl: "m1.png" },
      { id: "k2", bbox: [250, 150, 380, 280], score: 0.8, thumbUrl: "", maskUrl: "m2.png" },
    ],
  } as never;
}

describe("cleanupArtwork", () => {
  beforeEach(() => {
    state.updates = []; state.segmentCalls = []; state.rebuilt = []; state.products = []; state.segmentResult = null;
    state.failRebuild = new Set(); state.unpublish = new Set(); state.described = 0; state.candidatesResult = []; state.droppedContainer = false;
    state.uploadPath = "creators/c1/photo/u.jpg"; state.deleted = [];
  });

  it("candidateIds → union of the stored candidate masks, no SAM call", async () => {
    const artwork = await setup();
    const row = (await cleanupArtwork(artwork, { candidateIds: ["k1", "k2"] })).artwork as unknown as { cleanedUrl: string; status: string };
    expect(state.segmentCalls).toHaveLength(0);
    expect(row.status).toBe("ready");
    const cleaned = files.get(row.cleanedUrl)!;
    const meta = await sharp(cleaned).metadata();
    // the cut spans both pieces (bbox 20..380 × 20..280), upscaled so the short side reaches 900 px (≤ 2×)
    expect(meta.width! / meta.height!).toBeCloseTo(360 / 260, 1);
    expect(Math.abs(meta.width! - 720)).toBeLessThanOrEqual(6); // 2× plus the soft edge's few pixels
    const alpha = await maskFromAlpha(cleaned);
    const at = (x: number, y: number) => alpha.data[Math.round((y - 20) * 2) * alpha.width + Math.round((x - 20) * 2)];
    expect(at(70, 70)).toBe(1); // first piece
    expect(at(300, 200)).toBe(1); // second piece
    expect(at(200, 60)).toBe(0); // gap between them stays clear
  });

  it("points/box → one SAM call with labels, unioned with candidateIds; products are rebuilt", async () => {
    const artwork = await setup();
    state.products = [{ id: "p1" }, { id: "p2" }];
    state.segmentResult = { mask: rect(150, 20, 220, 90), bbox: [150, 20, 220, 90], score: 0.9, svgPath: "" };
    const hint = { candidateIds: ["k1"], points: [{ x: 180, y: 50, label: "positive" as const }, { x: 300, y: 200, label: "negative" as const }], box: [140, 10, 230, 100] as [number, number, number, number] };
    const out = await cleanupArtwork(artwork, hint);
    const row = out.artwork as unknown as { cleanedUrl: string };
    expect(out.failedProductIds).toEqual([]);
    expect(state.segmentCalls).toEqual([{ points: hint.points, box: hint.box }]);
    expect(state.rebuilt).toEqual(["p1", "p2"]);
    const meta = await sharp(files.get(row.cleanedUrl)!).metadata();
    expect(meta.width! / meta.height!).toBeCloseTo(200 / 100, 1); // k1 (20..120) ∪ SAM (150..220)
  });

  it("k1 + k2 with a negative point on k2 → k2 is taken out, no SAM call", async () => {
    const artwork = await setup();
    const out = await cleanupArtwork(artwork, { candidateIds: ["k1", "k2"], points: [{ x: 300, y: 200, label: "negative" }] });
    expect(state.segmentCalls).toHaveLength(0);
    const meta = await sharp(files.get((out.artwork as unknown as { cleanedUrl: string }).cleanedUrl)!).metadata();
    expect(meta.width! / meta.height!).toBeCloseTo(1, 1); // only k1 (100×100) is left
  });

  it("a failing product rebuild keeps the new cut and is reported; a failed print check is reported as unpublished", async () => {
    const artwork = await setup();
    state.products = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
    state.failRebuild = new Set(["p2"]);
    state.unpublish = new Set(["p3"]);
    const out = await cleanupArtwork(artwork, { candidateIds: ["k1"] });
    expect((out.artwork as unknown as { status: string }).status).toBe("ready");
    expect(state.rebuilt.sort()).toEqual(["p1", "p2", "p3"]);
    expect(out.failedProductIds).toEqual(["p2"]);
    expect(out.unpublishedProductIds).toEqual(["p3"]);
  });

  it("a single candidate covering most of the frame is not auto-selected", async () => {
    await setup();
    // the stored original is the upload upscaled to 800×600 (ensureDpi); masks come back at that size
    const big = (x0: number, y0: number, x1: number, y1: number): Mask => {
      const m = emptyMask(800, 600);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m.data[y * 800 + x] = 1;
      return m;
    };
    state.candidatesResult = [{ mask: big(20, 20, 780, 580), bbox: [20, 20, 780, 580], score: 0.6, svgPath: "" }];
    const { artwork, candidates } = await createFromImage("c1", { source: "photo", imageUrl: "upload.png", product: "sticker" });
    expect(candidates).toHaveLength(1);
    expect(state.described).toBe(0);
    expect((artwork as unknown as { cleanedUrl?: string }).cleanedUrl).toBeUndefined();
    state.candidatesResult = [{ mask: big(200, 200, 400, 400), bbox: [200, 200, 400, 400], score: 0.9, svgPath: "" }];
    await createFromImage("c1", { source: "photo", imageUrl: "upload.png", product: "sticker" });
    expect(state.described).toBe(1);
    // one small candidate left after a container was dropped → the picker, not an auto-select
    state.droppedContainer = true;
    const again = await createFromImage("c1", { source: "photo", imageUrl: "upload.png", product: "sticker" });
    expect(again.candidates).toHaveLength(1);
    expect(state.described).toBe(1);
  });

  it("deletes the public upload only when it is a source-picture upload", async () => {
    await setup();
    state.candidatesResult = [];
    for (const p of ["creators/c1/photo/u.jpg", "creators/c1/photos/u.jpg", "creators/c1/canvas/u.png"]) {
      state.uploadPath = p;
      await createFromImage("c1", { source: "photo", imageUrl: p, product: "sticker" }).catch(() => undefined);
    }
    expect(state.deleted).toEqual(["creators/c1/photo/u.jpg", "creators/c1/photos/u.jpg", "creators/c1/canvas/u.png"]);
    state.deleted = [];
    for (const p of ["creators/c1/thumbs/t.png", "creators/c1/mockups/m.png", "creators/c1/story-video/v.mp4", "creators/c1/avatar/a.jpg"]) {
      state.uploadPath = p;
      await createFromImage("c1", { source: "photo", imageUrl: p, product: "sticker" }).catch(() => undefined);
    }
    expect(state.deleted).toEqual([]);
  });

  it("unknown candidate → 400 invalid_candidate; nothing found → 422", async () => {
    const artwork = await setup();
    await expect(cleanupArtwork(artwork, { candidateIds: ["nope"] })).rejects.toMatchObject({ status: 400, code: "invalid_candidate" });
    await expect(cleanupArtwork(artwork, { box: [0, 0, 10, 10] })).rejects.toMatchObject({ status: 422, code: "no_drawing_found" });
  });
});

describe("CleanupBody", () => {
  const ok = (b: unknown) => CleanupBody.safeParse(b).success;
  it("needs at least one of candidateIds, points, box", () => {
    expect(ok({})).toBe(false);
    expect(ok({ phrase: "frog" })).toBe(false);
    expect(ok({ candidateIds: ["a"] })).toBe(true);
    expect(ok({ box: [0, 0, 10, 10] })).toBe(true);
  });
  it("validates point labels and defaults to positive", () => {
    expect(ok({ points: [{ x: 1, y: 2, label: "maybe" }] })).toBe(false);
    const parsed = CleanupBody.parse({ points: [{ x: 1, y: 2 }] });
    expect(parsed.points?.[0].label).toBe("positive");
  });
  it("rejects only-negative points without a box or candidates, inverted boxes and negative coordinates", () => {
    expect(ok({ points: [{ x: 1, y: 2, label: "negative" }] })).toBe(false);
    expect(ok({ candidateIds: ["a"], points: [{ x: 1, y: 2, label: "negative" }] })).toBe(true);
    expect(ok({ points: [{ x: 1, y: 2, label: "negative" }], box: [0, 0, 5, 5] })).toBe(true);
    expect(ok({ box: [10, 0, 5, 5] })).toBe(false);
    expect(ok({ points: [{ x: -1, y: 2 }] })).toBe(false);
    expect(ok({ candidateIds: [] })).toBe(false);
    expect(ok({ points: Array.from({ length: 11 }, () => ({ x: 1, y: 1 })) })).toBe(false);
  });
});
