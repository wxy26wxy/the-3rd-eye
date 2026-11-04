/** T153 round 2: Spark names the pieces, SAM searches the defaults plus those names, frame-filling masks go last. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { Mask } from "@/lib/ai/types";
import { emptyMask } from "@/lib/image/mask";
import { MetaDescriber } from "@/lib/ai/meta/describe";
import { withSubjectPhrases } from "@/lib/ai/meta/sam";
import { pngRef } from "@/lib/image/ref";

const state = { findOpts: [] as { phrases?: string[] }[], subjectCalls: 0, subjects: ["potted plant with a face"] as string[] | Error, found: [] as unknown[] };
vi.mock("@/lib/storage", () => ({ storage: () => ({}), creatorPath: () => "p", clientUploadPath: () => "p", readClientUpload: async () => Buffer.alloc(0) }));
vi.mock("@/lib/db/queries", () => ({}));
vi.mock("@/lib/pipeline/products", () => ({}));
vi.mock("@/lib/ai/registry", () => ({
  ai: async () => ({
    segmenter: { findCandidates: async (_i: unknown, o: { phrases?: string[] }) => { state.findOpts.push(o); return { segments: state.found, droppedContainer: false }; } },
    describer: { subjects: async () => { state.subjectCalls++; if (state.subjects instanceof Error) throw state.subjects; return state.subjects; } },
  }),
}));

import { segmentInBox } from "@/lib/pipeline/artworks";

const W = 40, H = 40;
function seg(x1: number, y1: number, score = 0.9) {
  const mask: Mask = emptyMask(W, H);
  for (let y = 0; y < y1; y++) for (let x = 0; x < x1; x++) mask.data[y * W + x] = 1;
  return { mask, bbox: [0, 0, x1, y1] as [number, number, number, number], score, svgPath: "" };
}
const png = () => sharp({ create: { width: W, height: H, channels: 3, background: "#fff" } }).png().toBuffer();
const run = async (phrases?: string[]) => segmentInBox(await png(), { w: W, h: H }, [0, 0, W, H], { stage: "segment" }, phrases);

beforeEach(() => { state.findOpts = []; state.subjectCalls = 0; state.subjects = ["potted plant with a face"]; state.found = [seg(W, H, 0.7), seg(20, 20, 0.95)]; });

describe("segmentInBox subjects (T153)", () => {
  it("(a) adds the subjects to the default phrases, de-duplicated, at most 5", async () => {
    state.subjects = ["Drawing", "potted plant", "coffee mug", "bookshelf"];
    await run();
    expect(state.findOpts[0].phrases).toEqual(["drawing", "handmade object", "potted plant", "coffee mug", "bookshelf"]);
    expect(withSubjectPhrases(["a", "b", "c", "d"])).toHaveLength(5);
  });
  it("(b) explicit phrases skip the subjects call", async () => {
    await run(["cactus in a pot"]);
    expect(state.subjectCalls).toBe(0);
    expect(state.findOpts[0].phrases).toEqual(["cactus in a pot"]);
  });
  it("(c) a failing subjects call warns and runs the default phrases", async () => {
    state.subjects = new Error("boom");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(run()).resolves.toHaveLength(2);
    expect(warn.mock.calls[0][0]).toContain("[subjects]");
    expect(state.findOpts[0].phrases).toBeUndefined();
    warn.mockRestore();
  });
  it("(d) a frame-filling mask goes last", async () => {
    const out = await run();
    expect(out.map((s) => s.bbox[2])).toEqual([20, W]);
  });
});

describe("segmentInBox tiny fragments (T154)", () => {
  // the crop is 40 x 40 = 1600 px: 0.5 % is 8 px, 2 % is 32 px
  const blob = (n: number) => { const s = seg(W, H, 0.5); s.mask.data.fill(0); for (let i = 0; i < n; i++) s.mask.data[i] = 1; s.bbox = [0, 0, n, 1]; return s; };
  it("drops a 0.5 % fragment and keeps a 2 % one", async () => {
    state.found = [blob(8), blob(32), seg(20, 20, 0.95)];
    const out = await run();
    expect(out.map((s) => s.bbox[2])).toEqual([20, 32]);
  });
  it("keeps a lone 0.5 % fragment", async () => {
    state.found = [blob(8)];
    expect(await run()).toHaveLength(1);
  });
});

describe("MetaDescriber.subjects (T153)", () => {
  it("(f) a malformed answer throws (caught upstream as a warning) and a non-array gives no subjects", async () => {
    const bad = new MetaDescriber({ create: async () => ({ id: "r", output_text: "not json" }) });
    await expect(bad.subjects(pngRef(await png()), { trace: { stage: "subjects" } })).rejects.toThrow();
    const notArray = new MetaDescriber({ create: async () => ({ id: "r", output_text: JSON.stringify({ subjects: "plant" }) }) });
    expect(await notArray.subjects(pngRef(await png()), { trace: { stage: "subjects" } })).toEqual([]);
  });

  it("(g) the subjects call carries its own short abort signal", async () => {
    const opts: unknown[] = [];
    const d = new MetaDescriber({ create: async (_b, o) => { opts.push(o); return { id: "r", output_text: JSON.stringify({ subjects: [] }) }; } });
    await d.subjects(pngRef(await png()), { trace: { stage: "subjects" } });
    expect((opts[0] as { signal?: AbortSignal }).signal).toBeInstanceOf(AbortSignal);
  });

  it("(e) strict schema, store:false, one image; answer trimmed, lower-cased, capped at 3", async () => {
    const sent: Record<string, unknown>[] = [];
    const d = new MetaDescriber({ create: async (b) => { sent.push(b as Record<string, unknown>); return { id: "r", output_text: JSON.stringify({ subjects: [" Potted Plant ", "Mug", "mug", "Book", "Lamp"] }) }; } });
    const out = await d.subjects(pngRef(await png()), { trace: { stage: "subjects" } });
    expect(out).toEqual(["potted plant", "mug", "book"]);
    const body = sent[0] as { store: boolean; text: { format: { strict: boolean; schema: { properties: { subjects: { type: string } } } } }; input: { content: { type: string }[] }[] };
    expect(body.store).toBe(false);
    expect(body.text.format.strict).toBe(true);
    expect(body.text.format.schema.properties.subjects.type).toBe("array");
    expect(body.input[0].content.filter((c) => c.type === "input_image")).toHaveLength(1);
  });
});
