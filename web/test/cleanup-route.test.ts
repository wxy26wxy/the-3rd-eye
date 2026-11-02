import { describe, expect, it, vi } from "vitest";

const calls: unknown[] = [];
vi.mock("@/lib/auth", () => ({ requireCreator: () => ({ creatorId: "c1" }) }));
vi.mock("@/lib/db/queries", () => ({
  getArtworkForCreator: async (id: string, cid: string) => (id === "a1" && cid === "c1"
    ? { id: "a1", creatorId: "c1", originalUrl: "o", candidates: [{ id: "k1" }, { id: "k2" }], status: "ready", createdAt: new Date(0) }
    : null),
  markArtworksFailed: async () => undefined,
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
});
