import { describe, expect, it, vi } from "vitest";

const filters: unknown[] = [];
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/pipeline/public", () => ({ placeOrder: async () => null, sendReply: async () => null, tap: async () => null }));
vi.mock("@/lib/db/queries", () => ({ listPublishedProducts: async (f: unknown) => { filters.push(f); return []; } }));

import { listShopProducts } from "@/lib/db/queries.contract";
import { parseFilter } from "@/components/shop/Collection";

describe("shop filter without 'Made by voice' (T111)", () => {
  it("all, sticker and tote map to the query; voice is no longer a filter", async () => {
    await listShopProducts("all");
    await listShopProducts("sticker");
    await listShopProducts("tote");
    expect(filters).toEqual([{}, { type: "sticker" }, { type: "tote" }]);
    expect(parseFilter("voice")).toBe("all");
    expect(parseFilter("tote")).toBe("tote");
  });
});
