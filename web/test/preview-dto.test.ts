import { describe, expect, it, vi } from "vitest";

const creator = {
  id: "c1", slug: "leo", displayName: "Leo", studioName: null, avatarUrl: null, bioShort: null, storyText: null,
  storyVideoUrl: null, storyVideoVtt: null, mentionDisability: false, split: { creator_bps: 5000 }, isExample: true, hidden: false,
};
const artwork = { id: "a1", source: "photo", altText: "A bus", spokenDescription: "A red bus", cleanedUrl: "https://pub/clean.png", cutPathSvg: null };
const row = (id: string, type: "sticker" | "tote", previewUrl: string | null) => ({
  product: { id, type, priceCents: 500, mockupUrl: `https://pub/${id}-mock.png`, previewUrl },
  listing: { title: "Bus", description: "A bus.", tags: [], madeByVoice: false }, creator, artwork,
});
const ID = "11111111-1111-4111-8111-111111111111";
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/pipeline/public", () => ({ placeOrder: async () => null, sendReply: async () => null, tap: async () => null }));
vi.mock("@/lib/db/queries", () => ({
  listPublishedProducts: async () => [row("p1", "sticker", "https://pub/p1-preview.png"), row("p2", "tote", null)],
  getPublicProduct: async (id: string) => (id === ID ? row(ID, "sticker", "https://pub/pv.png") : null),
}));

import { getProductDetail, listShopProducts } from "@/lib/db/queries.contract";
import { toProduct } from "@/lib/api/dto";

describe("previewUrl in DTOs (T121)", () => {
  it("shop cards carry the sticker preview; totes null", async () => {
    const out = await listShopProducts();
    expect(out.map((p) => [p.type, p.previewUrl])).toEqual([["sticker", "https://pub/p1-preview.png"], ["tote", null]]);
    expect(out[1].mockupUrl).toBe("https://pub/p2-mock.png");
  });

  it("the product page data carries it", async () => {
    expect((await getProductDetail(ID))?.previewUrl).toBe("https://pub/pv.png");
  });

  it("Product (POST /products, select, rebuild) carries it, null when missing", () => {
    const base = { id: "p1", artworkId: "a1", creatorId: "c1", type: "sticker", mockupUrl: null, printPngUrl: null, printSvgUrl: null, priceCents: 500, status: "draft" };
    expect(toProduct({ ...base, previewUrl: "https://pub/x.png" } as never).previewUrl).toBe("https://pub/x.png");
    expect(toProduct({ ...base, previewUrl: undefined } as never).previewUrl).toBeNull();
  });
});
