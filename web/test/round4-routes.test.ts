/** T143 (round 4) routes: `framed` on POST /artworks, `products` on cutout, POST /products on a change result. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const CH = "00000000-0000-4000-8000-0000000000c1"; // a change result, cut out
const CH_RAW = "00000000-0000-4000-8000-0000000000c2"; // a change result before its cutout
const base = { creatorId: "c1", source: "photo", status: "ready", createdAt: new Date(0), cleanedUrl: "https://x/c.png", originalUrl: "o", candidates: [], changeInstruction: null };
const calls = { image: [] as unknown[], imageTask: [] as unknown[], products: [] as unknown[] };
const summaries = new Map<string, unknown[]>();
vi.mock("@/lib/auth", () => ({ requireCreator: () => ({ creatorId: "c1" }) }));
vi.mock("@/lib/db/queries", () => ({
  getArtworkForCreator: async (id: string, cid: string) => {
    if (cid !== "c1") return null;
    if (id === CH) return { ...base, id: CH, parentArtworkId: "a1", changeInstruction: "make it purple" };
    if (id === CH_RAW) return { ...base, id: CH_RAW, parentArtworkId: "a1", changeInstruction: "make it purple", cleanedUrl: null, status: "draft" };
    return null;
  },
  getProductByClientRequest: async () => null,
  isUniqueViolation: () => false,
  markArtworksFailed: async () => undefined,
  listArtworksWithProducts: async () => [],
  listArtworkProductSummaries: async (id: string) => summaries.get(id) ?? [],
}));
vi.mock("@/lib/pipeline/artworks", async (orig) => ({
  assertChangeResult: (await orig<typeof import("@/lib/pipeline/artworks")>()).assertChangeResult,
  cutoutArtwork: async (a: { id: string }) => ({
    artwork: { ...a, cleanedUrl: "https://x/cut2.png", status: "ready", candidates: [{ id: "k1", bbox: [0, 0, 9, 9], score: 0.9, thumbUrl: "t1", maskUrl: "secret" }] },
    candidates: [], imageSize: { w: 1024, h: 1024 }, failedProductIds: ["prX"], unpublishedProductIds: [],
  }),
  createFromImage: async (_c: string, input: { framed?: boolean }, task: string) => {
    calls.image.push(input);
    calls.imageTask.push(task);
    const candidates = input.framed ? [{ id: "k1", bbox: [0, 0, 50, 50], score: 0.9, thumbUrl: "t1", maskUrl: "secret" }] : [];
    return {
      artwork: { ...base, id: "a9", candidates, cleanedUrl: input.framed ? "https://x/cut.png" : null, status: input.framed ? "ready" : "draft" },
      candidates, imageSize: { w: 800, h: 600 },
      ...(input.framed ? { details: { failedProductIds: [], unpublishedProductIds: [] } } : {}),
    };
  },
  createFromText: async () => [],
}));
vi.mock("@/lib/pipeline/products", () => ({
  createProductOnce: async (a: { id: string; changeInstruction: string | null; cleanedUrl: string | null }, type: string, _t: string, key?: string) => {
    calls.products.push({ artworkId: a.id, changeInstruction: a.changeInstruction, cleanedUrl: a.cleanedUrl, type, key });
    return { row: { id: "prC", artworkId: a.id, creatorId: "c1", type, mockupUrl: "https://x/m.png", previewUrl: "https://x/v.png", printPngUrl: "p", printSvgUrl: "s", priceCents: 500, status: "draft", clientRequestId: key ?? null }, repeated: false };
  },
}));

import { POST as createArtwork } from "@/app/api/v1/artworks/route";
import { POST as cutout } from "@/app/api/v1/artworks/[id]/cutout/route";
import { POST as createProduct } from "@/app/api/v1/products/route";

const req = (path: string, body?: unknown) => new Request(`http://x/api/v1/${path}`, {
  method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
});

beforeEach(() => { calls.image = []; calls.imageTask = []; calls.products = []; summaries.clear(); });

describe("POST /artworks {framed: true} (round 4: the upload is the crop)", () => {
  it("runs the framed detection (task T143) and answers 201 with the cut, candidates without mask paths, and details", async () => {
    const res = await createArtwork(req("artworks", { source: "photo", imageUrl: "creators/c1/photo/u.jpg", product: "sticker", framed: true }), undefined as never);
    expect(res.status).toBe(201);
    expect(calls.image).toEqual([{ source: "photo", imageUrl: "creators/c1/photo/u.jpg", product: "sticker", detect: undefined, framed: true }]);
    expect(calls.imageTask).toEqual(["T143"]);
    const body = await res.json();
    expect(body.artwork).toMatchObject({ id: "a9", cleanedUrl: "https://x/cut.png", status: "ready" });
    expect(body.candidates).toEqual([{ id: "k1", bbox: [0, 0, 50, 50], score: 0.9, thumbUrl: "t1" }]);
    expect(body.imageSize).toEqual({ w: 800, h: 600 });
    expect(body.details).toEqual({ failedProductIds: [], unpublishedProductIds: [] });
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("framed with detect:false is 400 invalid_request and runs nothing; without framed the answer has no details", async () => {
    const bad = await createArtwork(req("artworks", { source: "photo", imageUrl: "u", product: "sticker", framed: true, detect: false }), undefined as never);
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("invalid_request");
    expect(calls.image).toEqual([]);
    const plain = await createArtwork(req("artworks", { source: "photo", imageUrl: "u", product: "tote", detect: false }), undefined as never);
    expect(plain.status).toBe(201);
    expect(calls.imageTask).toEqual(["T010"]);
    expect((await plain.json()).details).toBeUndefined();
  });
});

describe("POST /artworks/{id}/cutout carries the row's products (T143)", () => {
  it("lists the rebuilt products in the ArtworkProduct shape", async () => {
    summaries.set(CH, [{ id: "prC", type: "tote", status: "draft", priceCents: 2200, title: null, description: null, mockupUrl: "https://x/m3.png", previewUrl: null, createdAt: new Date(0) }]);
    const res = await cutout(req(`artworks/${CH}/cutout`), { params: Promise.resolve({ id: CH }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.details).toEqual({ failedProductIds: ["prX"], unpublishedProductIds: [] }); // as on cleanup
    expect(body.products).toEqual([{ id: "prC", type: "tote", status: "draft", priceCents: 2200, title: null, description: null, mockupUrl: "https://x/m3.png", previewUrl: null }]);
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});

describe("POST /products on a change result (round 4: Changing = change → cutout → products)", () => {
  it("builds the product from the change result's cut: 201", async () => {
    const res = await createProduct(req("products", { artworkId: CH, type: "sticker", clientRequestId: "k-ch" }), undefined as never);
    expect(res.status).toBe(201);
    expect(calls.products).toEqual([{ artworkId: CH, changeInstruction: "make it purple", cleanedUrl: "https://x/c.png", type: "sticker", key: "k-ch" }]);
    expect(await res.json()).toMatchObject({ id: "prC", artworkId: CH, mockupUrl: "https://x/m.png", previewUrl: "https://x/v.png" });
  });

  it("before its cutout: 409 artwork_not_ready, nothing built", async () => {
    const res = await createProduct(req("products", { artworkId: CH_RAW, type: "sticker" }), undefined as never);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("artwork_not_ready");
    expect(calls.products).toEqual([]);
  });
});
