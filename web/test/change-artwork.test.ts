import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { Mask } from "@/lib/ai/types";
import { emptyMask } from "@/lib/image/mask";

const files = new Map<string, Buffer>();
const rows = new Map<string, Record<string, unknown>>();
const state = {
  edits: [] as { instruction: string; trace: { stage: string; artworkId?: string }; size: [number, number] }[],
  describes: [] as { prompt?: string; stage: string }[],
  candidatesResult: [] as { mask: Mask; bbox: [number, number, number, number]; score: number; svgPath: string }[],
  inserted: [] as Record<string, unknown>[],
};
let n = 0;
vi.mock("@/lib/storage", () => ({
  storage: () => ({
    read: async (p: string) => { const b = files.get(p.replace("https://public.example/", "")); if (!b) throw new Error(`missing ${p}`); return b; },
    putPublic: async (p: string, data: Buffer) => { files.set(p, data); return { pathname: p, url: `https://public.example/${p}` }; },
    putPrivate: async (p: string, data: Buffer) => { files.set(p, data); return { pathname: p, url: p }; },
    delete: async () => undefined,
  }),
  creatorPath: (c: string, kind: string, ext: string) => `creators/${c}/${kind}/${++n}.${ext}`,
  clientUploadPath: () => "", readClientUpload: async () => Buffer.alloc(0),
}));
vi.mock("@/lib/db/queries", () => ({
  updateArtwork: async (id: string, patch: Record<string, unknown>) => {
    const row = { ...(rows.get(id) ?? { id }), ...patch };
    rows.set(id, row);
    return row;
  },
  insertArtwork: async (v: { id: string }) => { state.inserted.push(v); rows.set(v.id, v); return v; },
  listProductsForArtwork: async () => [],
}));
vi.mock("@/lib/pipeline/products", () => ({ rebuildProductFiles: async () => ({ unpublished: false }) }));
vi.mock("@/lib/ai/registry", () => ({
  ai: async () => ({
    image: {
      edit: async (image: { base64: string }, instruction: string, opts: { trace: { stage: string; artworkId?: string } }) => {
        const meta = await sharp(Buffer.from(image.base64, "base64")).metadata();
        state.edits.push({ instruction, trace: opts.trace, size: [meta.width ?? 0, meta.height ?? 0] });
        const png = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#fff" } })
          .composite([{ input: await sharp({ create: { width: 200, height: 150, channels: 3, background: "#7040c0" } }).png().toBuffer(), top: 50, left: 50 }])
          .png().toBuffer();
        return { png, responseId: "resp_edit_1", width: 400, height: 300 };
      },
    },
    segmenter: {
      findCandidates: async () => ({ segments: state.candidatesResult, droppedContainer: false }),
      segment: async () => null,
    },
    describer: {
      describe: async (_img: unknown, opts: { prompt?: string; trace: { stage: string } }) => {
        state.describes.push({ prompt: opts.prompt, stage: opts.trace.stage });
        return { alt_text: "Purple box", spoken: "A purple box on white.", dominant_colors: [], subject: "box", differences_from_prompt: "The box is purple, not violet." };
      },
    },
  }),
}));

import { changeArtwork, changeInput, cutoutArtwork } from "@/lib/pipeline/artworks";

type Row = Parameters<typeof changeArtwork>[0];
const W = 400, H = 300;
function rect(x0: number, y0: number, x1: number, y1: number): Mask {
  const m = emptyMask(W, H);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m.data[y * W + x] = 1;
  return m;
}
const seg = (m: Mask, bbox: [number, number, number, number], score: number) => ({ mask: m, bbox, score, svgPath: "" });

const parent = (over: Partial<Row> = {}): Row => ({
  id: "parent-1", creatorId: "c1", source: "photo", transcript: null, shapedPrompt: null, shapingTrace: { product: "sticker", imageSize: { w: 900, h: 600 } },
  originalUrl: "creators/c1/originals/p.png", cleanedUrl: "creators/c1/cleaned/p.png", maskUrl: null, cutPathSvg: null, candidates: [],
  altText: null, spokenDescription: null, differencesFromPrompt: null, genResponseId: null, parentArtworkId: null, changeInstruction: null,
  artworkVideoUrl: null, status: "ready", lastError: null, createdAt: new Date(0), deletedAt: null, createdByTask: "T010", ...over,
} as Row);

beforeEach(async () => {
  files.clear(); rows.clear(); n = 0;
  state.edits = []; state.describes = []; state.inserted = []; state.candidatesResult = [];
  // The picked piece: a transparent 300x200 cut with an opaque centre.
  files.set("creators/c1/cleaned/p.png", await sharp({ create: { width: 300, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp({ create: { width: 100, height: 100, channels: 4, background: "#30a050" } }).png().toBuffer(), top: 50, left: 100 }]).png().toBuffer());
});

describe("changeInput", () => {
  it("squares the picked piece on white with a margin", async () => {
    const png = await changeInput(parent());
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(meta.height);
    expect(meta.width).toBe(Math.round(300 * 1.2));
    expect(meta.hasAlpha).toBe(false);
  });
  it("uses a change result's stored picture when it has no cut-out yet", async () => {
    files.set("creators/c1/originals/child.png", await sharp({ create: { width: 2000, height: 2000, channels: 3, background: "#fff" } }).png().toBuffer());
    const png = await changeInput(parent({ cleanedUrl: null, originalUrl: "creators/c1/originals/child.png", changeInstruction: "add a hat" }));
    expect((await sharp(png).metadata()).width).toBe(1024);
  });
  it("refuses a row with nothing picked yet (409 artwork_not_ready)", async () => {
    await expect(changeInput(parent({ cleanedUrl: null }))).rejects.toMatchObject({ status: 409, code: "artwork_not_ready" });
  });
});

describe("changeArtwork (T111)", () => {
  it("makes a described child row linked to the parent", async () => {
    const { artwork, description } = await changeArtwork(parent(), { instruction: "  make it purple ", transcript: "make it purple" });
    expect(state.edits).toHaveLength(1);
    expect(state.edits[0].instruction).toBe("make it purple");
    expect(state.edits[0].trace).toMatchObject({ stage: "edit", artworkId: artwork.id, task: "T111" });
    const child = state.inserted[0];
    expect(child).toMatchObject({
      creatorId: "c1", source: "photo", parentArtworkId: "parent-1", changeInstruction: "make it purple", transcript: "make it purple",
      genResponseId: "resp_edit_1", status: "draft",
    });
    expect(child.id).not.toBe("parent-1");
    expect(child.shapingTrace).toMatchObject({ product: "sticker", imageSize: { w: 400, h: 300 }, changedFrom: "parent-1" });
    expect((child.shapingTrace as { previewUrl: string }).previewUrl).toMatch(/^https:\/\/public\.example\/creators\/c1\/previews\//);
    expect(String(child.originalUrl)).toMatch(/^creators\/c1\/originals\//);
    expect(files.has(String(child.originalUrl))).toBe(true);
    expect(state.describes).toEqual([{ prompt: "make it purple", stage: "describe" }]);
    expect(artwork).toMatchObject({ altText: "Purple box", spokenDescription: "A purple box on white.", differencesFromPrompt: "The box is purple, not violet." });
    expect(description.differences_from_prompt).toBe("The box is purple, not violet.");
    expect(artwork.cleanedUrl ?? null).toBeNull();
  });

  it("change it again edits the child, and the next child points at it", async () => {
    const first = await changeArtwork(parent(), { instruction: "make it purple" });
    const again = await changeArtwork(first.artwork as Row, { instruction: "add stars" });
    expect(state.inserted[1]).toMatchObject({ parentArtworkId: first.artwork.id, changeInstruction: "add stars", transcript: null });
    expect(again.artwork.id).not.toBe(first.artwork.id);
  });
});

describe("cutoutArtwork (T111)", () => {
  it("stores candidates largest first and cuts out the largest", async () => {
    const { artwork: child } = await changeArtwork(parent(), { instruction: "make it purple" });
    state.describes = [];
    const small = seg(rect(10, 10, 40, 40), [10, 10, 40, 40], 0.99);
    const big = seg(rect(50, 50, 250, 200), [50, 50, 250, 200], 0.8);
    state.candidatesResult = [small, big];
    const out = await cutoutArtwork(child as Row);
    expect(out.imageSize).toEqual({ w: 400, h: 300 });
    expect(out.candidates.map((c) => c.bbox)).toEqual([[50, 50, 250, 200], [10, 10, 40, 40]]);
    expect(out.artwork.status).toBe("ready");
    expect(out.artwork.cleanedUrl).toBeTruthy();
    expect(out.artwork.candidates).toHaveLength(2);
    const cut = await sharp(await (await import("@/lib/storage")).storage().read(String(out.artwork.cleanedUrl))).metadata();
    expect(cut.width).toBeGreaterThan(150); // the big piece, not the 30 px one
    // Described again against the change request so differencesFromPrompt stays meaningful.
    expect(state.describes[0].prompt).toBe("make it purple");
    expect((out.artwork.shapingTrace as { previewUrl?: string }).previewUrl).toBeTruthy();
  });

  it("422 no_drawing_found when SAM finds nothing", async () => {
    const { artwork: child } = await changeArtwork(parent(), { instruction: "make it purple" });
    state.candidatesResult = [];
    await expect(cutoutArtwork(child as Row)).rejects.toMatchObject({ status: 422, code: "no_drawing_found" });
    expect(rows.get(child.id)?.lastError).toBe("no_drawing_found");
  });
});
