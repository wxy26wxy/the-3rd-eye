/**
 * Opt-in, READ-ONLY check of the T080 queries against the real database (LIVE_DB=1 with
 * DATABASE_URL set): the joined artworks × products × listings select and the archive filter.
 *   cd web && LIVE_DB=1 pnpm exec dotenv -e .env.local -- vitest run test/live/artwork-queries.live.test.ts
 */
import { describe, expect, it } from "vitest";
import { listArtworksWithProducts, listCreators, listProductsForArtwork } from "@/lib/db/queries";

describe.skipIf(process.env.LIVE_DB !== "1" || !process.env.DATABASE_URL)("live artwork queries (read-only)", () => {
  it("lists every creator's artworks with products", async () => {
    let artworks = 0, withProducts = 0;
    for (const c of await listCreators()) {
      const rows = await listArtworksWithProducts(c.id);
      artworks += rows.length;
      for (const a of rows) {
        if (a.products.length) withProducts++;
        expect(new Set(a.products.map((p) => p.id)).size).toBe(a.products.length);
        if (a.products.length) {
          const live = await listProductsForArtwork(a.id);
          expect(live.every((p) => p.status !== "archived")).toBe(true);
        }
      }
    }
    console.log({ artworks, withProducts });
    expect(artworks).toBeGreaterThan(0);
  }, 120_000);
});
