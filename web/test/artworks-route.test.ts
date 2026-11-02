import { describe, expect, it, vi } from "vitest";

const rows = [{
  id: "a1", creatorId: "c1", source: "photo", transcript: null, shapedPrompt: null, originalUrl: "o", cleanedUrl: "c", maskUrl: "m",
  cutPathSvg: "M0 0Z", altText: "A frog", spokenDescription: "A frog", differencesFromPrompt: null, genResponseId: null,
  parentArtworkId: null, status: "ready", lastError: null, createdAt: new Date(0),
  products: [{ id: "p1", type: "sticker", status: "published", priceCents: 500, title: "Frog sticker", description: "A frog.", mockupUrl: "https://x/m.png", previewUrl: "https://x/pv.png" }],
}];
const deleted: string[] = [];
vi.mock("@/lib/auth", () => ({ requireCreator: () => ({ creatorId: "c1" }) }));
vi.mock("@/lib/db/queries", () => ({
  listArtworksWithProducts: async (cid: string) => (cid === "c1" ? rows : []),
  getArtworkForCreator: async (id: string, cid: string) => (id === "a1" && cid === "c1" ? { ...rows[0], candidates: [{ id: "k1", bbox: [0, 0, 5, 5], score: 1, thumbUrl: "t", maskUrl: "secret" }], shapingTrace: { imageSize: { w: 1200, h: 900 } } } : null),
  deleteArtworkArchivingProducts: async (id: string) => { deleted.push(id); return ["p1"]; },
  markArtworksFailed: async () => undefined,
}));
vi.mock("@/lib/storage", () => ({ storage: () => ({ signedUrl: async (p: string, ttl: number) => `https://signed/${p}?ttl=${ttl}` }) }));
vi.mock("@/lib/pipeline/artworks", () => ({
  createFromImage: async () => null, createFromText: async () => [],
  originalSize: async (a: { shapingTrace?: { imageSize?: unknown } }) => a.shapingTrace?.imageSize ?? null,
}));

import { GET as list } from "@/app/api/v1/artworks/route";
import { DELETE, GET } from "@/app/api/v1/artworks/[id]/route";

const req = (method = "GET") => new Request("http://x/api/v1/artworks", { method });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("artwork routes", () => {
  it("GET /artworks carries products per artwork", async () => {
    const res = await list(req(), undefined as never);
    const body = await res.json();
    expect(body.artworks[0].products).toEqual([{ id: "p1", type: "sticker", status: "published", priceCents: 500, title: "Frog sticker", description: "A frog.", mockupUrl: "https://x/m.png", previewUrl: "https://x/pv.png" }]);
    expect(body.artworks[0].id).toBe("a1");
  });

  it("GET /artworks/{id} returns candidates (no mask paths), imageSize and a 10-minute original URL", async () => {
    const body = await (await GET(req(), ctx("a1"))).json();
    expect(body.imageSize).toEqual({ w: 1200, h: 900 });
    expect(body.originalUrl).toBe("https://signed/o?ttl=600");
    expect(body.candidates).toEqual([{ id: "k1", bbox: [0, 0, 5, 5], score: 1, thumbUrl: "t" }]);
    expect(body.artwork.id).toBe("a1");
    expect((await GET(req(), ctx("other"))).status).toBe(404);
  });

  it("DELETE /artworks/{id} soft-deletes and reports the archived products", async () => {
    const body = await (await DELETE(req("DELETE"), ctx("a1"))).json();
    expect(body).toEqual({ id: "a1", deleted: true, archivedProductIds: ["p1"] });
    expect(deleted).toEqual(["a1"]);
    expect((await DELETE(req("DELETE"), ctx("zzz"))).status).toBe(404);
  });
});
