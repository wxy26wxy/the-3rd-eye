/**
 * Hidden (testing) creators stay out of the public shop lists (T070). The queries run
 * against a fake Neon client that records the SQL, so no database is needed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const seen: { sql: string; params: unknown[] }[] = [];

vi.mock("@/lib/db/client", async () => {
  const { drizzle } = await import("drizzle-orm/neon-http");
  const schema = await import("./schema");
  const fake = { query: async (sql: string, params: unknown[]) => { seen.push({ sql, params }); return { rows: [], fields: [] }; } };
  const db = drizzle(fake as never, { schema });
  return { getDb: () => db };
});

import { getPublicProduct, listCreators, listCreatorsAdmin, listPublishedProducts } from "./queries";

const HIDDEN_FALSE = /"creators"\."hidden" = \$\d+/;
const lastQuery = () => seen[seen.length - 1];
const hiddenParamIsFalse = () => {
  const q = lastQuery();
  const n = Number(HIDDEN_FALSE.exec(q.sql)![0].split("$")[1]);
  return q.params[n - 1] === false;
};

beforeEach(() => { seen.length = 0; });

describe("hidden creators", () => {
  it("are left out of shop grids and 'more from this studio'", async () => {
    await listPublishedProducts();
    expect(lastQuery().sql).toMatch(HIDDEN_FALSE);
    expect(hiddenParamIsFalse()).toBe(true);
    await listPublishedProducts({ creatorId: "00000000-0000-0000-0000-000000000000", limit: 7 });
    expect(lastQuery().sql).toMatch(HIDDEN_FALSE);
  });

  it("are left out of the public creator list (/artists, featured artist)", async () => {
    await listCreators();
    expect(lastQuery().sql).toMatch(HIDDEN_FALSE);
    expect(hiddenParamIsFalse()).toBe(true);
  });

  it("are still listed for the admin", async () => {
    await listCreators({ includeHidden: true });
    expect(lastQuery().sql).not.toMatch(HIDDEN_FALSE);
    await listCreatorsAdmin();
    expect(lastQuery().sql).not.toMatch(HIDDEN_FALSE);
    expect(lastQuery().sql).not.toContain("login_code");
  });

  it("still open by direct product link", async () => {
    await getPublicProduct("00000000-0000-0000-0000-000000000000");
    expect(lastQuery().sql).not.toMatch(HIDDEN_FALSE);
  });
});
