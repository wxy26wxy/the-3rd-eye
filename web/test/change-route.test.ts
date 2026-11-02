import { describe, expect, it, vi } from "vitest";

const calls: { change: unknown[]; cutout: string[] } = { change: [], cutout: [] };
const base = { creatorId: "c1", source: "photo", status: "ready", createdAt: new Date(0), cleanedUrl: "https://x/c.png", originalUrl: "o", candidates: [] };
vi.mock("@/lib/auth", () => ({ requireCreator: () => ({ creatorId: "c1" }) }));
vi.mock("@/lib/db/queries", () => ({
  getArtworkForCreator: async (id: string, cid: string) => {
    if (cid !== "c1") return null;
    if (id === "a1") return { ...base, id: "a1" };
    if (id === "bare") return { ...base, id: "bare", originalUrl: null, cleanedUrl: null };
    return null;
  },
  markArtworksFailed: async () => undefined,
}));
vi.mock("@/lib/pipeline/artworks", () => ({
  changeArtwork: async (p: { id: string }, input: unknown) => {
    calls.change.push(input);
    return {
      artwork: { ...base, id: "child", cleanedUrl: null, status: "draft", parentArtworkId: p.id, changeInstruction: "make it purple", transcript: "make it purple",
        shapingTrace: { previewUrl: "https://x/previews/child.png" }, altText: "Purple", spokenDescription: "Purple.", differencesFromPrompt: null, genResponseId: "resp_1" },
      description: { alt_text: "Purple", spoken: "Purple.", dominant_colors: [], subject: "x", differences_from_prompt: "" },
    };
  },
  cutoutArtwork: async (a: { id: string }) => {
    calls.cutout.push(a.id);
    const candidates = [{ id: "k1", bbox: [0, 0, 9, 9], score: 0.9, thumbUrl: "t1", maskUrl: "secret1" }, { id: "k2", bbox: [0, 0, 2, 2], score: 0.99, thumbUrl: "t2", maskUrl: "secret2" }];
    return { artwork: { ...a, cleanedUrl: "https://x/cut.png", status: "ready", candidates }, candidates, imageSize: { w: 1600, h: 1600 } };
  },
}));

import { POST as change } from "@/app/api/v1/artworks/[id]/change/route";
import { POST as cutout } from "@/app/api/v1/artworks/[id]/cutout/route";

const post = (fn: typeof change, path: string, id: string, body?: unknown) => fn(
  new Request(`http://x/api/v1/artworks/${id}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }),
  { params: Promise.resolve({ id }) },
);

describe("POST /artworks/{id}/change (T111)", () => {
  it("201 with the child (parent link, change fields, previewUrl) and the description", async () => {
    const res = await post(change, "change", "a1", { instruction: " make it purple ", transcript: "make it purple" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(calls.change.at(-1)).toEqual({ instruction: "make it purple", transcript: "make it purple" });
    expect(body.artwork).toMatchObject({ id: "child", parentArtworkId: "a1", changeInstruction: "make it purple", source: "photo", cleanedUrl: null, previewUrl: "https://x/previews/child.png" });
    expect(body.description).toEqual({ alt: "Purple", spoken: "Purple.", differences: "" });
  });
  it("validates the instruction and the artwork", async () => {
    expect((await post(change, "change", "a1", { instruction: "   " })).status).toBe(400);
    expect((await post(change, "change", "a1", { instruction: "x".repeat(1001) })).status).toBe(400);
    expect((await post(change, "change", "a1", {})).status).toBe(400);
    expect((await post(change, "change", "nope", { instruction: "x" })).status).toBe(404);
  });
});

describe("POST /artworks/{id}/cutout (T111)", () => {
  it("returns the cut-out row, candidates without mask paths, and imageSize", async () => {
    const res = await post(cutout, "cutout", "a1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.artwork).toMatchObject({ id: "a1", cleanedUrl: "https://x/cut.png", status: "ready" });
    expect(body.candidates).toEqual([{ id: "k1", bbox: [0, 0, 9, 9], score: 0.9, thumbUrl: "t1" }, { id: "k2", bbox: [0, 0, 2, 2], score: 0.99, thumbUrl: "t2" }]);
    expect(body.imageSize).toEqual({ w: 1600, h: 1600 });
    expect(JSON.stringify(body)).not.toContain("secret");
  });
  it("404 for someone else's artwork, 400 without a stored picture", async () => {
    expect((await post(cutout, "cutout", "nope")).status).toBe(404);
    const res = await post(cutout, "cutout", "bare");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("no_original");
    expect(calls.cutout).toEqual(["a1"]);
  });
});
