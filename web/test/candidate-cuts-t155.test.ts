/** T155: every candidate gets its own cut at detection; a pure pick adopts the ready cut (offline, mocked storage/DB/SAM). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { Mask } from "@/lib/ai/types";
import { emptyMask } from "@/lib/image/mask";

const files = new Map<string, Buffer>();
type TestRow = Record<string, unknown> & { candidates?: { id: string; cleanedUrl?: string }[]; cleanedUrl?: string; maskUrl?: string; cutPathSvg?: string };
const rows = new Map<string, TestRow>();
const state = {
  crop: [] as { mask: Mask; bbox: [number, number, number, number]; score: number; svgPath: string }[],
  cutCalls: [] as { artworkId: string; candidateId: string; fields: Record<string, unknown> }[],
  describeCalls: 0, rebuilt: [] as string[], products: [] as { id: string }[], afterQueue: [] as (() => Promise<unknown>)[], deferAfter: false,
};
let n = 0;
vi.mock("next/server", () => ({
  after: (fn: () => Promise<unknown>) => {
    if (!state.deferAfter) throw new Error("`after` was called outside a request scope");
    state.afterQueue.push(fn);
  },
}));
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
    const row = { ...(rows.get(id) ?? { id }), ...patch };
    rows.set(id, row);
    return row;
  },
  setCandidateCut: async (artworkId: string, candidateId: string, fields: Record<string, unknown>) => {
    state.cutCalls.push({ artworkId, candidateId, fields });
    const row = rows.get(artworkId);
    if (!row?.candidates?.some((c: { id: string }) => c.id === candidateId)) return;
    row.candidates = row.candidates.map((c: { id: string }) => (c.id === candidateId ? { ...c, ...fields } : c));
  },
  getArtwork: async (id: string) => rows.get(id) ?? null,
  updateArtworkIfCleaned: async (id: string, cleanedUrl: string, patch: Record<string, unknown>) => {
    const row = rows.get(id);
    if (!row || row.cleanedUrl !== cleanedUrl) return null;
    const next = { ...row, ...patch };
    rows.set(id, next);
    return next;
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
      segment: async () => { throw new Error("SAM must not be called"); },
      findCandidates: async () => ({ segments: state.crop, droppedContainer: false }),
    },
    describer: {
      describe: async () => { state.describeCalls++; return { alt_text: "New alt", spoken: "New spoken", dominant_colors: [], subject: "art", differences_from_prompt: "" }; },
      subjects: async () => [],
    },
  }),
}));
vi.mock("@/lib/image/ref", () => ({ pngRef: (b: Buffer) => ({ data: b }) }));

import { cleanupArtwork, createFromImage, detectInBox, selectCandidate } from "@/lib/pipeline/artworks";
import { runAfterResponse } from "@/lib/pipeline/after";
import { toCandidates } from "@/lib/api/dto";

const W = 400, H = 300;
function rect(x0: number, y0: number, x1: number, y1: number): Mask {
  const m = emptyMask(W, H);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m.data[y * W + x] = 1;
  return m;
}
const seg = (m: Mask, bbox: [number, number, number, number]) => ({ mask: m, bbox, score: 0.9, svgPath: "" });
async function photoRow(extra: Record<string, unknown> = {}) {
  files.set("orig.png", await sharp({ create: { width: W, height: H, channels: 3, background: "#cc3344" } }).png().toBuffer());
  const row = { id: "a1", creatorId: "c1", source: "photo", originalUrl: "orig.png", shapedPrompt: null, changeInstruction: null, candidates: [], shapingTrace: { imageSize: { w: W, h: H } }, ...extra };
  rows.set("a1", row);
  return row as never;
}
const three = () => [seg(rect(10, 10, 110, 110), [10, 10, 110, 110]), seg(rect(150, 20, 220, 90), [150, 20, 220, 90]), seg(rect(250, 200, 300, 250), [250, 200, 300, 250])];

beforeEach(() => {
  state.crop = []; state.cutCalls = []; state.describeCalls = 0; state.rebuilt = []; state.products = []; state.afterQueue = []; state.deferAfter = false; rows.clear(); files.clear();
});

describe("runAfterResponse", () => {
  it("awaits inline when `after` throws (no request scope)", async () => {
    let ran = false;
    await runAfterResponse(async () => { ran = true; });
    expect(ran).toBe(true);
  });
  it("hands the work to `after` inside a request and does not wait for it", async () => {
    state.deferAfter = true;
    let ran = false;
    await runAfterResponse(async () => { ran = true; });
    expect(ran).toBe(false);
    await state.afterQueue[0]();
    expect(ran).toBe(true);
  });
  it("never rejects: a failing background task is logged", async () => {
    await expect(runAfterResponse(async () => { throw new Error("boom"); })).resolves.toBeUndefined();
  });
});

describe("per-candidate cuts at detection", () => {
  it("detectInBox: candidates 2..n get cleanedUrl, cutMaskUrl and cutPathSvg; the first carries the row's own files and is not re-cut", async () => {
    const artwork = await photoRow();
    state.crop = three();
    const out = await detectInBox(artwork, [0, 0, W, H]);
    const row = rows.get("a1")!;
    expect(state.cutCalls.map((c) => c.candidateId).sort()).toEqual([out.candidates[1].id, out.candidates[2].id].sort());
    for (const c of state.cutCalls) {
      expect(c.artworkId).toBe("a1");
      expect(Object.keys(c.fields).sort()).toEqual(["cleanedUrl", "cutMaskUrl", "cutPathSvg"]);
      expect(files.has(c.fields.cleanedUrl as string)).toBe(true);
      expect(files.has(c.fields.cutMaskUrl as string)).toBe(true);
    }
    expect(row.candidates![0]).toMatchObject({ cleanedUrl: row.cleanedUrl, cutMaskUrl: row.maskUrl, cutPathSvg: row.cutPathSvg });
    expect(row.candidates![1].cleanedUrl).toBeTruthy();
    expect(row.candidates![2].cleanedUrl).toBeTruthy();
    expect(out.candidates[0].cleanedUrl).toBe(row.cleanedUrl);
    const meta = await sharp(files.get(row.candidates![2].cleanedUrl!)!).metadata();
    expect(meta.width! / meta.height!).toBeCloseTo(1, 1); // the third piece is a 50x50 square, trimmed
  });

  it("in a request the cuts are scheduled, not awaited", async () => {
    state.deferAfter = true;
    const artwork = await photoRow();
    state.crop = three();
    await detectInBox(artwork, [0, 0, W, H]);
    expect(state.cutCalls).toHaveLength(0);
    for (const f of state.afterQueue) await f();
    expect(state.cutCalls).toHaveLength(2);
  });

  it("the plain photo path with several candidates cuts them all (none is the row's own)", async () => {
    files.set("upload.png", await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } }).png().toBuffer());
    state.crop = three();
    const out = await createFromImage("c1", { source: "photo", imageUrl: "creators/c1/photo/u.jpg", product: "sticker" });
    expect(out.candidates).toHaveLength(3);
    expect(state.cutCalls).toHaveLength(3);
  });

  it("a piece that fails to cut is skipped, the others still land", async () => {
    const artwork = await photoRow();
    state.crop = [...three().slice(0, 2), seg(emptyMask(W, H), [0, 0, 1, 1])];
    await detectInBox(artwork, [0, 0, W, H]);
    expect(state.cutCalls.map((c) => c.candidateId)).toHaveLength(1);
  });
});

describe("a pure pick adopts the ready cut", () => {
  const ready = { cleanedUrl: "cut2.png", cutMaskUrl: "mask2.png", cutPathSvg: "M0 0" };
  async function rowWithCuts(notReady = false) {
    const artwork = await photoRow({
      cleanedUrl: "cut1.png", maskUrl: "mask1.png", cutPathSvg: "M1 1", altText: "Old alt", spokenDescription: "Old spoken", status: "ready",
      candidates: [
        { id: "k1", bbox: [0, 0, 5, 5], score: 1, thumbUrl: "t1", maskUrl: "m1", cleanedUrl: "cut1.png", cutMaskUrl: "mask1.png", cutPathSvg: "M1 1" },
        { id: "k2", bbox: [0, 0, 5, 5], score: 1, thumbUrl: "t2", maskUrl: "m2", ...(notReady ? {} : ready) },
      ],
    });
    files.set("cut2.png", await sharp({ create: { width: 20, height: 20, channels: 3, background: "#00ff00" } }).png().toBuffer());
    return artwork;
  }

  it("copies the three fields, keeps the previous description, rebuilds products, describes after the response, never cuts", async () => {
    state.deferAfter = true;
    state.products = [{ id: "pr1" }];
    const artwork = await rowWithCuts();
    const out = await cleanupArtwork(artwork, { candidateIds: ["k2"], box: [0, 0, W, H], clipToBox: true });
    expect(out.artwork).toMatchObject({ cleanedUrl: "cut2.png", maskUrl: "mask2.png", cutPathSvg: "M0 0", altText: "Old alt", spokenDescription: "Old spoken", status: "ready" });
    expect(state.rebuilt).toEqual(["pr1"]);
    expect(state.describeCalls).toBe(0); // deferred
    expect(state.afterQueue).toHaveLength(1);
    expect([...files.keys()].filter((k) => k.startsWith("creators/c1/cleaned/"))).toEqual([]); // cutParts would have stored a new cleaned PNG
    await state.afterQueue[0]();
    expect(state.describeCalls).toBe(1);
    expect(rows.get("a1")).toMatchObject({ cleanedUrl: "cut2.png", altText: "New alt", spokenDescription: "New spoken" });
  });

  it("select adopts likewise (no box)", async () => {
    const artwork = await rowWithCuts();
    const row = await selectCandidate(artwork, "k2");
    expect(row).toMatchObject({ cleanedUrl: "cut2.png", maskUrl: "mask2.png", altText: "Old alt" }); // the answer keeps the old description
    expect(rows.get("a1")).toMatchObject({ altText: "New alt" }); // no request scope: described inline
    expect(state.cutCalls).toHaveLength(0);
  });

  it("a candidate whose cut is not ready falls back to the re-cut", async () => {
    const artwork = await rowWithCuts(true);
    files.set("m2", await (await import("@/lib/image/mask")).maskToPng(rect(10, 10, 100, 100)));
    const out = await cleanupArtwork(artwork, { candidateIds: ["k2"], box: [0, 0, W, H], clipToBox: true });
    expect(out.artwork.cleanedUrl).not.toBe("cut2.png");
    expect(String(out.artwork.cleanedUrl)).toMatch(/cleaned/);
    expect(state.describeCalls).toBe(1); // the re-cut describes before answering
  });

  it("marks, or a box smaller than the picture, always re-cut", async () => {
    const artwork = await rowWithCuts();
    files.set("m2", await (await import("@/lib/image/mask")).maskToPng(rect(10, 10, 100, 100)));
    const small = await cleanupArtwork(artwork, { candidateIds: ["k2"], box: [0, 0, 100, 100], clipToBox: true });
    expect(String(small.artwork.cleanedUrl)).toMatch(/cleaned/);
    expect(state.describeCalls).toBe(1);
  });
});

describe("T155 review fixes", () => {
  const cand = (id: string, extra: Record<string, unknown> = {}) => ({ id, bbox: [0, 0, 5, 5], score: 1, thumbUrl: "t", maskUrl: "m", ...extra });
  const cutOf = (n: number) => ({ cleanedUrl: `cut${n}.png`, cutMaskUrl: `mask${n}.png`, cutPathSvg: `P${n}` });

  it("a late describe is not written once a second adopt changed the cut", async () => {
    state.deferAfter = true;
    const artwork = await photoRow({ cleanedUrl: "cut1.png", altText: "Old", candidates: [cand("k1", cutOf(1)), cand("k2", cutOf(2)), cand("k3", cutOf(3))] });
    files.set("cut2.png", await sharp({ create: { width: 8, height: 8, channels: 3, background: "#00ff00" } }).png().toBuffer());
    files.set("cut3.png", await sharp({ create: { width: 8, height: 8, channels: 3, background: "#0000ff" } }).png().toBuffer());
    await cleanupArtwork(artwork, { candidateIds: ["k2"], box: [0, 0, W, H], clipToBox: true });
    await cleanupArtwork(rows.get("a1") as never, { candidateIds: ["k3"], box: [0, 0, W, H], clipToBox: true });
    expect(rows.get("a1")!.cleanedUrl).toBe("cut3.png");
    await state.afterQueue[0](); // the first describe resolves late
    expect(rows.get("a1")!.altText).toBe("Old");
    await state.afterQueue[1]();
    expect(rows.get("a1")!.altText).toBe("New alt");
  });

  it("points force a re-cut even for a ready candidate", async () => {
    const artwork = await photoRow({ candidates: [cand("k2", cutOf(2))] });
    files.set("m", await (await import("@/lib/image/mask")).maskToPng(rect(10, 10, 100, 100)));
    const out = await cleanupArtwork(artwork, { candidateIds: ["k2"], box: [0, 0, W, H], clipToBox: true, points: [{ x: 500, y: 500, label: "negative" }] });
    expect(String(out.artwork.cleanedUrl)).toMatch(/cleaned/);
  });

  it("the plain photo path cuts largest first and at most 6", async () => {
    files.set("upload.png", await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } }).png().toBuffer());
    state.crop = [
      seg(rect(0, 0, 20, 20), [0, 0, 20, 20]), seg(rect(30, 0, 80, 50), [30, 0, 80, 50]), seg(rect(100, 0, 200, 100), [100, 0, 200, 100]),
      seg(rect(210, 0, 230, 30), [210, 0, 230, 30]), seg(rect(240, 0, 270, 40), [240, 0, 270, 40]), seg(rect(280, 0, 300, 25), [280, 0, 300, 25]), seg(rect(310, 0, 320, 10), [310, 0, 320, 10]),
    ];
    const out = await createFromImage("c1", { source: "photo", imageUrl: "creators/c1/photo/u.jpg", product: "sticker" });
    expect(out.candidates.length).toBeLessThanOrEqual(6);
    expect(state.cutCalls).toHaveLength(out.candidates.length);
    const areaOf = (id: string) => { const b = out.candidates.find((c) => c.id === id)!.bbox; return (b[2] - b[0]) * (b[3] - b[1]); };
    const order = state.cutCalls.map((c) => areaOf(c.candidateId));
    expect(order[0]).toBe(10000); // the largest starts first
    expect(order.slice(0, 2)).toContain(2500);
  });

  it("a piece whose candidate was replaced meanwhile is skipped: nothing stored", async () => {
    const artwork = await photoRow();
    state.crop = three();
    state.deferAfter = true;
    const out = await detectInBox(artwork, [0, 0, W, H]);
    rows.set("a1", { ...rows.get("a1")!, candidates: [cand("new1")] }); // a newer detection replaced them
    const before = files.size;
    for (const f of state.afterQueue) await f();
    expect(state.cutCalls).toHaveLength(0);
    expect(files.size).toBe(before);
    expect(out.candidates).toHaveLength(3);
  });
});

describe("candidate DTO", () => {
  it("exposes cleanedUrl only (never the mask or path fields)", () => {
    const out = toCandidates({ candidates: [{ id: "k", bbox: [0, 0, 1, 1], score: 0.5, thumbUrl: "t", maskUrl: "m", cleanedUrl: "c.png", cutMaskUrl: "cm", cutPathSvg: "p" }] } as never);
    expect(out).toEqual([{ id: "k", bbox: [0, 0, 1, 1], score: 0.5, thumbUrl: "t", cleanedUrl: "c.png" }]);
    expect(toCandidates({ candidates: [{ id: "k", bbox: [0, 0, 1, 1], score: 0.5, thumbUrl: "t", maskUrl: "m" }] } as never)[0]).not.toHaveProperty("cleanedUrl", "c.png");
  });
});
