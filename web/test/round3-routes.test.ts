/** T134 routes: detect, clientRequestId on change/products, GET /listings/{productId}, detect flag on POST /artworks. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const base = { creatorId: "c1", source: "photo", status: "ready", createdAt: new Date(0), cleanedUrl: "https://x/c.png", originalUrl: "o", candidates: [], changeInstruction: null };
const calls = { detect: [] as unknown[], change: [] as unknown[], products: [] as unknown[], image: [] as unknown[], repeat: [] as string[] };
const byKey = { artworks: new Map<string, Record<string, unknown>>(), products: new Map<string, Record<string, unknown>>() };
const listings = new Map<string, Record<string, unknown>>();
vi.mock("@/lib/auth", () => ({ requireCreator: () => ({ creatorId: "c1" }) }));
vi.mock("@/lib/db/queries", () => ({
  getArtworkForCreator: async (id: string, cid: string) => {
    if (cid !== "c1") return null;
    if (id === "a1" || id === "00000000-0000-4000-8000-000000000001") return { ...base, id };
    if (id === "ch1") return { ...base, id: "ch1", changeInstruction: "purple", parentArtworkId: "a1" };
    if (id === "gen") return { ...base, id: "gen", source: "text2image" };
    return null;
  },
  getArtworkByClientRequest: async (_c: string, key: string) => byKey.artworks.get(key) ?? null,
  getProductByClientRequest: async (_c: string, key: string) => byKey.products.get(key) ?? null,
  getProductForCreator: async (id: string, cid: string) => (cid === "c1" && (id === "pr1" || id === "pr2")
    ? { id, artworkId: "a1", creatorId: "c1", type: "sticker", mockupUrl: "m", previewUrl: "pv", printPngUrl: "p", printSvgUrl: "s", priceCents: 500, status: "draft", clientRequestId: null }
    : null),
  getListing: async (id: string) => listings.get(id) ?? null,
  isUniqueViolation: () => false,
  markArtworksFailed: async () => undefined,
  listArtworksWithProducts: async () => [],
}));
vi.mock("@/lib/pipeline/artworks", async (orig) => ({
  assertPhotoRow: (await orig<typeof import("@/lib/pipeline/artworks")>()).assertPhotoRow,
  detectInBox: async (a: { id: string }, box: unknown) => {
    calls.detect.push(box);
    const candidates = [{ id: "k1", bbox: [10, 10, 90, 90], score: 0.9, thumbUrl: "t1", maskUrl: "secret" }];
    return { artwork: { ...a, cleanedUrl: "https://x/cut.png", candidates }, candidates, imageSize: { w: 400, h: 300 }, failedProductIds: [], unpublishedProductIds: [] };
  },
  changeArtwork: async (p: { id: string }, input: { clientRequestId?: string }) => {
    calls.change.push(input);
    const row = { ...base, id: "child", parentArtworkId: p.id, changeInstruction: "purple", cleanedUrl: null, status: "draft", altText: "Purple", spokenDescription: "Purple.", differencesFromPrompt: null, clientRequestId: input.clientRequestId ?? null };
    if (input.clientRequestId) byKey.artworks.set(input.clientRequestId, row);
    return { artwork: row, description: { alt_text: "Purple", spoken: "Purple.", dominant_colors: [], subject: "", differences_from_prompt: "" } };
  },
  changeRepeat: async (row: { id: string; altText: string | null; spokenDescription: string | null }) => {
    calls.repeat.push(row.id);
    const alt = row.altText ?? "Described now";
    return { artwork: { ...row, altText: alt }, description: { alt_text: alt, spoken: row.spokenDescription ?? "Said now.", dominant_colors: [], subject: "", differences_from_prompt: "" } };
  },
  createFromImage: async (_c: string, input: unknown) => {
    calls.image.push(input);
    return { artwork: { ...base, id: "a9", cleanedUrl: null, status: "draft" }, candidates: [], imageSize: { w: 1200, h: 900 } };
  },
  createFromText: async () => [],
}));
vi.mock("@/lib/pipeline/products", () => ({
  createProductOnce: async (a: { id: string }, type: string, _t: string, key?: string) => {
    calls.products.push({ artworkId: a.id, type, key });
    const row = { id: "prN", artworkId: a.id, creatorId: "c1", type, mockupUrl: "m", previewUrl: null, printPngUrl: "p", printSvgUrl: null, priceCents: 500, status: "draft", clientRequestId: key ?? null, deletedAt: null };
    if (key) byKey.products.set(key, row);
    return { row, repeated: false };
  },
}));

import { POST as detect } from "@/app/api/v1/artworks/[id]/detect/route";
import { POST as change } from "@/app/api/v1/artworks/[id]/change/route";
import { POST as createArtwork } from "@/app/api/v1/artworks/route";
import { POST as createProduct } from "@/app/api/v1/products/route";
import { GET as getListing } from "@/app/api/v1/listings/[productId]/route";

const req = (path: string, body?: unknown, method = "POST") => new Request(`http://x/api/v1/${path}`, {
  method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
});
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const A1 = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  calls.detect = []; calls.change = []; calls.products = []; calls.image = []; calls.repeat = [];
  byKey.artworks.clear(); byKey.products.clear(); listings.clear();
});

describe("POST /artworks/{id}/detect", () => {
  it("passes the box and answers artwork, candidates (no mask paths), imageSize and details", async () => {
    const res = await detect(req("artworks/a1/detect", { box: [0, 0, 100, 80] }), ctx("a1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(calls.detect).toEqual([[0, 0, 100, 80]]);
    expect(body.candidates).toEqual([{ id: "k1", bbox: [10, 10, 90, 90], score: 0.9, thumbUrl: "t1" }]);
    expect(body.imageSize).toEqual({ w: 400, h: 300 });
    expect(body.details).toEqual({ failedProductIds: [], unpublishedProductIds: [] });
    expect(body.artwork.cleanedUrl).toBe("https://x/cut.png");
  });

  it("400 for a missing, inverted, negative or extra-keyed box; 404 for another artwork; 409 not_a_photo for a change result or a generated row", async () => {
    expect((await detect(req("artworks/a1/detect", {}), ctx("a1"))).status).toBe(400);
    expect((await detect(req("artworks/a1/detect", { box: [50, 0, 10, 80] }), ctx("a1"))).status).toBe(400);
    expect((await detect(req("artworks/a1/detect", { box: [-1, 0, 10, 80] }), ctx("a1"))).status).toBe(400);
    expect((await detect(req("artworks/a1/detect", { box: [0, 0, 10, 80], clipToBox: true }), ctx("a1"))).status).toBe(400);
    expect((await detect(req("artworks/zz/detect", { box: [0, 0, 10, 10] }), ctx("zz"))).status).toBe(404);
    for (const id of ["ch1", "gen"]) {
      const res = await detect(req(`artworks/${id}/detect`, { box: [0, 0, 10, 10] }), ctx(id));
      expect(res.status).toBe(409);
      expect((await res.json()).error.code).toBe("not_a_photo");
    }
    expect(calls.detect).toHaveLength(0);
  });
});

describe("POST /artworks detect flag", () => {
  it("passes detect:false through and answers candidates [] with imageSize; omitted stays undefined (default true)", async () => {
    const res = await createArtwork(req("artworks", { source: "photo", imageUrl: "creators/c1/photo/u.jpg", product: "sticker", detect: false }), undefined as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.candidates).toEqual([]);
    expect(body.imageSize).toEqual({ w: 1200, h: 900 });
    expect(calls.image.at(-1)).toMatchObject({ detect: false });
    await createArtwork(req("artworks", { source: "photo", imageUrl: "creators/c1/photo/u.jpg", product: "sticker" }), undefined as never);
    expect((calls.image.at(-1) as { detect?: boolean }).detect).toBeUndefined();
    expect((await createArtwork(req("artworks", { source: "photo", imageUrl: "x", product: "sticker", detect: "no" }), undefined as never)).status).toBe(400);
  });
});

describe("clientRequestId", () => {
  it("change: first 201, a repeat 200 with the same row and no second model call; another parent → 409", async () => {
    const first = await change(req("artworks/a1/change", { instruction: "make it purple", clientRequestId: "n-1" }), ctx("a1"));
    expect(first.status).toBe(201);
    const a = await first.json();
    expect(a.artwork.clientRequestId).toBe("n-1");
    const again = await change(req("artworks/a1/change", { instruction: "make it purple", clientRequestId: "n-1" }), ctx("a1"));
    expect(again.status).toBe(200);
    const b = await again.json();
    expect(b.artwork.id).toBe(a.artwork.id);
    expect(b.description).toEqual({ alt: "Purple", spoken: "Purple.", differences: "" });
    expect(calls.change).toHaveLength(1);
    expect(calls.repeat).toEqual([a.artwork.id]);
    const other = await change(req("artworks/ch1/change", { instruction: "make it purple", clientRequestId: "n-1" }), ctx("ch1"));
    expect(other.status).toBe(409);
    expect((await other.json()).error.code).toBe("client_request_conflict");
    expect((await change(req("artworks/a1/change", { instruction: "x", clientRequestId: "" }), ctx("a1"))).status).toBe(400);
  });

  it("change: a repeat whose row has no description yet is described before answering", async () => {
    byKey.artworks.set("n-2", { ...base, id: "child2", parentArtworkId: "a1", changeInstruction: "purple", cleanedUrl: null, status: "draft", altText: null, spokenDescription: null, differencesFromPrompt: null, clientRequestId: "n-2" });
    const res = await change(req("artworks/a1/change", { instruction: "purple", clientRequestId: "n-2" }), ctx("a1"));
    expect(res.status).toBe(200);
    expect((await res.json()).description).toEqual({ alt: "Described now", spoken: "Said now.", differences: "" });
    expect(calls.change).toHaveLength(0);
  });

  it("products: first 201, a repeat 200 with the same product and no second build; another type → 409", async () => {
    const first = await createProduct(req("products", { artworkId: A1, type: "sticker", clientRequestId: "u-1" }), undefined as never);
    expect(first.status).toBe(201);
    const p = await first.json();
    expect(p.clientRequestId).toBe("u-1");
    const again = await createProduct(req("products", { artworkId: A1, type: "sticker", clientRequestId: "u-1" }), undefined as never);
    expect(again.status).toBe(200);
    expect((await again.json()).id).toBe(p.id);
    expect(calls.products).toHaveLength(1);
    expect((await createProduct(req("products", { artworkId: A1, type: "tote", clientRequestId: "u-1" }), undefined as never)).status).toBe(409);
    expect((await createProduct(req("products", { artworkId: A1, type: "sticker" }), undefined as never)).status).toBe(201);
    expect(calls.products).toHaveLength(2);
  });

  it("products: a stored key answers 200 before the artwork is even read", async () => {
    byKey.products.set("u-2", { id: "pr7", artworkId: A1, creatorId: "c1", type: "sticker", mockupUrl: "m", previewUrl: null, printPngUrl: "p", printSvgUrl: null, priceCents: 500, status: "draft", clientRequestId: "u-2", deletedAt: null });
    const res = await createProduct(req("products", { artworkId: A1, type: "sticker", clientRequestId: "u-2" }), undefined as never);
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("pr7");
    const conflict = await createProduct(req("products", { artworkId: A1, type: "tote", clientRequestId: "u-2" }), undefined as never);
    expect(conflict.status).toBe(409);
    expect(calls.products).toHaveLength(0);
  });
});

describe("GET /listings/{productId}", () => {
  it("nulls before the first run; the stored listing and its draft after", async () => {
    const before = await (await getListing(req("listings/pr1", undefined, "GET"), { params: Promise.resolve({ productId: "pr1" }) })).json();
    expect(before.product.id).toBe("pr1");
    expect(before.listing).toBeNull();
    expect(before.draft).toBeNull();
    listings.set("pr1", {
      productId: "pr1", title: "Frog", description: "A frog.", tags: ["frog"], priceSuggestionCents: 600, approvedAt: null, approvedVia: null, madeByVoice: false,
      printCheck: { version: 2, print_ok: false, check: "contrast", notes: "Low contrast." }, draftCopy: null,
    });
    const after = await (await getListing(req("listings/pr1", undefined, "GET"), { params: Promise.resolve({ productId: "pr1" }) })).json();
    expect(after.listing).toMatchObject({ productId: "pr1", title: "Frog", priceSuggestionCents: 600 });
    expect(after.draft).toEqual({ title: "Frog", description: "A frog.", tags: ["frog"], price_cents: 600, print_ok: false, print_check: "contrast", notes: "Low contrast." });
    expect((await getListing(req("listings/zz", undefined, "GET"), { params: Promise.resolve({ productId: "zz" }) })).status).toBe(404);
  });

  it("a published product with a pending re-run answers the pending copy as the draft; an old stored check derives print_check", async () => {
    listings.set("pr2", {
      productId: "pr2", title: "Live", description: "Live.", tags: [], priceSuggestionCents: 500, approvedAt: new Date(0), approvedVia: "tap", madeByVoice: false,
      printCheck: { print_ok: true },
      draftCopy: { title: "New", description: "New.", tags: ["n"], priceSuggestionCents: 700, printCheck: { print_ok: false, resolution: { ok: false }, notes: "Too small." }, moderation: null, agentTrace: [], createdAt: "x" },
    });
    const body = await (await getListing(req("listings/pr2", undefined, "GET"), { params: Promise.resolve({ productId: "pr2" }) })).json();
    expect(body.listing.title).toBe("Live");
    expect(body.draft).toEqual({ title: "New", description: "New.", tags: ["n"], price_cents: 700, print_ok: false, print_check: "resolution", notes: "Too small." });
  });
});
