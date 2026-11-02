import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  product: { id: "p1", creatorId: "c1", type: "sticker" as "sticker" | "tote", priceCents: 500 },
  inserted: [] as Record<string, unknown>[],
};
vi.mock("@/lib/db/queries", () => ({
  getPublicProduct: async (id: string) => (id === "p1" ? { product: state.product } : null),
  getCreatorById: async () => ({ id: "c1", split: { creator_bps: 5000, org_bps: 3000, production_bps: 2000 } }),
  insertOrderWithToken: async (order: Record<string, unknown>, token: string) => { state.inserted.push(order); return { token }; },
}));
vi.mock("@/lib/notify/polling", () => ({ notifyNewOrder: async () => undefined }));
vi.mock("@/lib/pipeline/notes", () => ({ moderateNote: async () => undefined }));

import { orderLine, placeOrder } from "@/lib/payments/staged";
import { resolveSize, SIZES, unitCents } from "@/lib/products/sizes";
import { PRODUCTS } from "@/lib/products/registry";
import { m } from "@/components/messages";

beforeEach(() => {
  state.inserted = [];
  state.product = { id: "p1", creatorId: "c1", type: "sticker", priceCents: 500 };
});

describe("size table (T111)", () => {
  it("stickers: 3 in = listed price, 4 in +$2, sheet +$6; totes have no sizes", () => {
    expect(SIZES.sticker.map((s) => [s.key, s.addCents])).toEqual([["3in", 0], ["4in", 200], ["sheet", 600]]);
    expect(SIZES.tote).toEqual([]);
    expect(PRODUCTS.sticker.sizes).toBe(SIZES.sticker);
    expect(PRODUCTS.tote.sizes).toEqual([]);
    for (const s of SIZES.sticker) expect(m.product.sizes[s.key]).toBeTruthy();
  });
  it("unit price and default size", () => {
    expect(unitCents({ type: "sticker", priceCents: 500 }, "sheet")).toBe(1100);
    expect(unitCents({ type: "tote", priceCents: 2500 }, null)).toBe(2500);
    expect(resolveSize("sticker", undefined)).toBe("3in");
    expect(resolveSize("sticker", "")).toBe("3in");
    expect(resolveSize("tote", undefined)).toBeNull();
    expect(() => resolveSize("tote", "3in")).toThrow();
    expect(() => resolveSize("sticker", "5in")).toThrow();
  });
});

describe("orderLine / placeOrder price math (T111)", () => {
  it("total = unit × quantity; shares come from the total", async () => {
    expect(orderLine({ type: "sticker", priceCents: 500 }, { size: "4in", quantity: 3 })).toEqual({ size: "4in", quantity: 3, amountCents: 2100 });
    await placeOrder("p1", { buyerName: " Ana ", size: "4in", quantity: 3 });
    expect(state.inserted[0]).toMatchObject({
      size: "4in", quantity: 3, amountCents: 2100, creatorShareCents: 1050, orgShareCents: 630, productionShareCents: 420, buyerName: "Ana",
    });
  });
  it("an older client (no size, no quantity) buys one 3 in sticker at the listed price", async () => {
    await placeOrder("p1", { buyerName: "Ana" });
    expect(state.inserted[0]).toMatchObject({ size: "3in", quantity: 1, amountCents: 500 });
  });
  it("a tote has no size; sending one is 400 invalid_size", async () => {
    state.product = { ...state.product, type: "tote", priceCents: 2500 };
    await placeOrder("p1", { buyerName: "Ana", quantity: 2 });
    expect(state.inserted[0]).toMatchObject({ size: null, quantity: 2, amountCents: 5000 });
    await expect(placeOrder("p1", { buyerName: "Ana", size: "4in" })).rejects.toMatchObject({ status: 400, code: "invalid_size" });
  });
  it("rejects an unknown size and a quantity outside 1–10 without placing an order", async () => {
    await expect(placeOrder("p1", { buyerName: "Ana", size: "huge" })).rejects.toMatchObject({ status: 400, code: "invalid_size" });
    await expect(placeOrder("p1", { buyerName: "Ana", quantity: 0 })).rejects.toMatchObject({ status: 400, code: "invalid_request" });
    await expect(placeOrder("p1", { buyerName: "Ana", quantity: 11 })).rejects.toMatchObject({ status: 400 });
    await expect(placeOrder("p1", { buyerName: "Ana", quantity: 1.5 })).rejects.toMatchObject({ status: 400 });
    expect(state.inserted).toHaveLength(0);
  });
});
