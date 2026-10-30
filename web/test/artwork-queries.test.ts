import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/pg-proxy";
import * as schema from "@/lib/db/schema";

/** Captures the SQL drizzle sends (pg-proxy); `batch` runs the queries in order, like neon-http's transaction. */
const sent: { sql: string; params: unknown[] }[] = [];
let respond: (sql: string) => unknown[][] = () => [];
const proxy = drizzle(async (sql, params) => { sent.push({ sql, params }); return { rows: respond(sql) }; }, { schema });
const db = Object.assign(proxy, { batch: async (qs: Promise<unknown>[]) => { const out = []; for (const q of qs) out.push(await q); return out; } });
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));

import { deleteArtworkArchivingProducts, groupArtworkProducts, listPublishedProducts, type ArtworkRow } from "@/lib/db/queries";

describe("DELETE artwork → products archived and out of the shop", () => {
  beforeEach(() => { sent.length = 0; respond = () => []; });

  it("archives the artwork's live products and soft-deletes the artwork in one batch", async () => {
    respond = (sql) => (sql.startsWith("update \"products\"") ? [["p1"], ["p2"]] : []);
    const ids = await deleteArtworkArchivingProducts("a1");
    expect(ids).toEqual(["p1", "p2"]);
    expect(sent).toHaveLength(2);
    expect(sent[0].sql).toMatch(/^update "products" set "status" = \$1 where \("products"\."artwork_id" = \$2 and "products"\."deleted_at" is null and "products"\."status" <> \$3\) returning "id"/);
    expect(sent[0].params).toEqual(["archived", "a1", "archived"]);
    expect(sent[1].sql).toMatch(/^update "artworks" set "deleted_at" = \$1 where "artworks"\."id" = \$2/);
  });

  it("the shop list only shows published products of live artworks (archived ones drop out)", async () => {
    await listPublishedProducts();
    expect(sent[0].sql).toContain(`"products"."status" = $1`);
    expect(sent[0].params[0]).toBe("published");
    expect(sent[0].sql).toContain(`"artworks"."deleted_at" is null`);
  });
});

describe("GET /artworks products", () => {
  const art = (id: string, t: number) => ({ id, createdAt: new Date(t) }) as unknown as ArtworkRow;
  it("groups joined rows: artwork order kept, products newest first, artworks without products get []", () => {
    const out = groupArtworkProducts([
      { artwork: art("a2", 2), product: { id: "p1", type: "sticker", status: "draft", priceCents: 500, mockupUrl: null, createdAt: new Date(10) }, title: null, description: null },
      { artwork: art("a2", 2), product: { id: "p2", type: "tote", status: "published", priceCents: 2200, mockupUrl: "https://x/m.png", createdAt: new Date(20) }, title: "Frog tote", description: "A frog." },
      { artwork: art("a1", 1), product: null, title: null, description: null },
    ]);
    expect(out.map((a) => a.id)).toEqual(["a2", "a1"]);
    expect(out[0].products).toEqual([
      { id: "p2", type: "tote", status: "published", priceCents: 2200, mockupUrl: "https://x/m.png", title: "Frog tote", description: "A frog." },
      { id: "p1", type: "sticker", status: "draft", priceCents: 500, mockupUrl: null, title: null, description: null },
    ]);
    expect(out[1].products).toEqual([]);
  });
});
