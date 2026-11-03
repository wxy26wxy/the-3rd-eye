import { describe, expect, it, vi } from "vitest";

const calls: unknown[] = [];
vi.mock("@/lib/auth", () => ({ requireCreator: () => ({ creatorId: "c1" }) }));
vi.mock("@/lib/db/queries", () => ({
  getArtworkForCreator: async (id: string, cid: string) => (id === "a1" && cid === "c1"
    ? { id: "a1", creatorId: "c1", originalUrl: "o", candidates: [{ id: "k1" }, { id: "k2" }], status: "ready", createdAt: new Date(0) }
    : id === "ch1" && cid === "c1"
      ? { id: "ch1", creatorId: "c1", originalUrl: "o2", parentArtworkId: "a1", changeInstruction: "make it purple", candidates: [{ id: "k9" }], status: "ready", createdAt: new Date(0) }
      : null),
  markArtworksFailed: async () => undefined,
  // T143: the row's products after the rebuild (the DB shape; the route maps it to ArtworkProduct).
  listArtworkProductSummaries: async (id: string) => (id === "a1"
    ? [{ id: "p1", type: "sticker", status: "draft", priceCents: 500, title: "Bird", description: null, mockupUrl: "https://x/m2.png", previewUrl: "https://x/v2.png" }]
    : []),
}));
vi.mock("@/lib/pipeline/artworks", () => ({
  cleanupArtwork: async (a: { id: string }, hint: unknown) => {
    calls.push(hint);
    return { artwork: { ...a, cleanedUrl: "new.png", status: "ready" }, failedProductIds: ["p2"], unpublishedProductIds: [] };
  },
}));

import { POST } from "@/app/api/v1/artworks/[id]/cleanup/route";

const post = (id: string, body: unknown) => POST(
  new Request(`http://x/api/v1/artworks/${id}/cleanup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  { params: Promise.resolve({ id }) },
);

describe("POST /artworks/{id}/cleanup", () => {
  it("passes candidateIds + labelled points to the pipeline and reports failed product rebuilds", async () => {
    const res = await post("a1", { candidateIds: ["k1", "k2"], points: [{ x: 5, y: 6, label: "negative" }] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cleanedUrl).toBe("new.png");
    expect(body.details).toEqual({ failedProductIds: ["p2"], unpublishedProductIds: [] });
    expect(body.products).toEqual([{ id: "p1", type: "sticker", status: "draft", priceCents: 500, title: "Bird", description: null, mockupUrl: "https://x/m2.png", previewUrl: "https://x/v2.png" }]);
    expect(calls.at(-1)).toEqual({ candidateIds: ["k1", "k2"], points: [{ x: 5, y: 6, label: "negative" }] });
  });

  it("400 for an empty body, a phrase-only body, a bad label, an unknown candidate; 404 for another creator's artwork", async () => {
    expect((await post("a1", {})).status).toBe(400);
    expect((await post("a1", { phrase: "frog" })).status).toBe(400);
    expect((await post("a1", { points: [{ x: 1, y: 1, label: "maybe" }] })).status).toBe(400);
    const bad = await post("a1", { candidateIds: ["nope"] });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("invalid_candidate");
    expect((await post("zz", { candidateIds: ["k1"] })).status).toBe(404);
  });

  it("passes clipToBox with the box; clipToBox without a box is 400 invalid_request (T126)", async () => {
    const res = await post("a1", { candidateIds: ["k1"], box: [1, 2, 30, 40], clipToBox: true });
    expect(res.status).toBe(200);
    expect(calls.at(-1)).toEqual({ candidateIds: ["k1"], box: [1, 2, 30, 40], clipToBox: true });
    const before = calls.length;
    const bad = await post("a1", { candidateIds: ["k1"], clipToBox: true });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("invalid_request");
    expect(calls.length).toBe(before);
  });

  it("accepts a change result (T129): points + the whole-picture box + clipToBox, with or without its cutout's piece", async () => {
    const body = { candidateIds: ["k9"], points: [{ x: 10, y: 20, label: "negative" }], box: [0, 0, 400, 300], clipToBox: true };
    const res = await post("ch1", body);
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.id).toBe("ch1");
    expect(out.parentArtworkId).toBe("a1");
    expect(out.changeInstruction).toBe("make it purple");
    expect(out.products).toEqual([]);
    expect(calls.at(-1)).toEqual(body);
    expect((await post("ch1", { points: body.points, box: body.box, clipToBox: true })).status).toBe(200);
    expect((await post("ch1", { candidateIds: ["k1"], box: body.box, clipToBox: true })).status).toBe(400); // the original's pieces are not this row's
  });
});
