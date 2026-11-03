/**
 * T149 `pnpm move-orders`: argument parsing, the guards (different creator, unpublished / deleted target,
 * draft source, foreign --order ids), dry runs that never write, the --order subset, and the two queries
 * against a fake Neon client (the UPDATE sets product_id only and carries the guards in SQL).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { sql: string; params: unknown[] };
const calls: Call[] = [];
let respond: (c: Call) => { rows: unknown[][] } = () => ({ rows: [] });

vi.mock("@/lib/db/client", async () => {
  const { drizzle } = await import("drizzle-orm/neon-http");
  const schema = await import("@/lib/db/schema");
  const fake = {
    query: async (sql: string, params: unknown[]) => {
      const c = { sql, params };
      calls.push(c);
      return { ...respond(c), fields: [] };
    },
  };
  const db = drizzle(fake as never, { schema });
  return { getDb: () => db };
});

import { getMoveOrdersPlan, moveOrdersToProduct, type MoveOrdersProduct } from "@/lib/db/queries";
import {
  initials, moveOrders, parseMoveOrdersArgs, refusal, type MoveOrdersArgs, type MoveOrdersDeps, type MoveOrdersPlan,
} from "@/lib/pipeline/move-orders";

const FROM = "11111111-1111-4111-8111-111111111111";
const TO = "22222222-2222-4222-8222-222222222222";
const O1 = "33333333-3333-4333-8333-333333333333";
const O2 = "44444444-4444-4444-8444-444444444444";
const JUNE = "55555555-5555-4555-8555-555555555555";
const OTHER = "66666666-6666-4666-8666-666666666666";

const product = (over: Partial<MoveOrdersProduct> & { id: string }): MoveOrdersProduct =>
  ({ creatorId: JUNE, type: "tote", status: "published", deleted: false, title: "A tote", ...over });
const order = (id: string, buyerName: string) => ({ id, buyerName, status: "placed" as const, createdAt: new Date("2026-10-30T12:00:00Z") });
const plan = (over: Partial<MoveOrdersPlan> = {}): MoveOrdersPlan => ({
  from: product({ id: FROM, status: "archived", title: "Loud Little Birds Tote by June" }),
  to: product({ id: TO, title: "Grumpy Ivy Pot Tote by June" }),
  orders: [order(O1, "Maya Ortiz"), order(O2, "sam lee-park")],
  ...over,
});
const args = (over: Partial<MoveOrdersArgs> = {}): MoveOrdersArgs => ({ fromProductId: FROM, toProductId: TO, dryRun: false, allowTypeChange: false, ...over });

function deps(p: MoveOrdersPlan, moved?: string[]) {
  const lines: string[] = [];
  const d = {
    getPlan: vi.fn(async () => p),
    move: vi.fn<MoveOrdersDeps["move"]>(async (_f, _t, ids) => moved ?? ids ?? p.orders.map((o) => o.id)),
    log: (line: string) => { lines.push(line); },
  } satisfies MoveOrdersDeps;
  return { d, lines };
}

beforeEach(() => { calls.length = 0; respond = () => ({ rows: [] }); });

describe("pnpm move-orders: arguments", () => {
  it("parses the two product ids, repeated --order and --dry-run in any order", () => {
    expect(parseMoveOrdersArgs([FROM, "--order", O1, TO, "--dry-run", "--order", O2.toUpperCase(), "--order", O1]))
      .toEqual({ fromProductId: FROM, toProductId: TO, dryRun: true, allowTypeChange: false, orderIds: [O1, O2] });
    expect(parseMoveOrdersArgs([FROM, TO])).toEqual({ fromProductId: FROM, toProductId: TO, dryRun: false, allowTypeChange: false, orderIds: undefined });
    expect(parseMoveOrdersArgs(["--allow-type-change", FROM, TO]).allowTypeChange).toBe(true);
  });

  it("rejects missing ids, non-uuids, the same product twice, unknown options and --order without a value", () => {
    expect(() => parseMoveOrdersArgs([FROM])).toThrow(/source product id and the target/);
    expect(() => parseMoveOrdersArgs([FROM, TO, O1])).toThrow(/source product id and the target/);
    expect(() => parseMoveOrdersArgs([FROM, "98512c82"])).toThrow(/not a full id/);
    expect(() => parseMoveOrdersArgs([FROM, TO, "--order", "46301607"])).toThrow(/not a full id/);
    expect(() => parseMoveOrdersArgs([FROM, FROM.toUpperCase()])).toThrow(/the same/);
    expect(() => parseMoveOrdersArgs([FROM, TO, "--force"])).toThrow(/unknown option/);
    expect(() => parseMoveOrdersArgs([FROM, TO, "--order"])).toThrow(/needs an order id/);
    expect(() => parseMoveOrdersArgs([FROM, TO, "--order", "--dry-run"])).toThrow(/needs an order id/);
  });

  it("redacts buyer names to initials", () => {
    expect(initials("Maya Ortiz")).toBe("M. O.");
    expect(initials("  sam  lee-park ")).toBe("S. L.");
    expect(initials("Émile")).toBe("É.");
    expect(initials("   ")).toBe("?");
  });
});

describe("pnpm move-orders: guards", () => {
  it("refuses products of different creators", () => {
    expect(refusal(args(), plan({ to: product({ id: TO, creatorId: OTHER }) }))).toMatch(/different creators/);
  });
  it("refuses an unpublished target (draft or archived)", () => {
    expect(refusal(args(), plan({ to: product({ id: TO, status: "draft" }) }))).toMatch(/target product is draft, not published/);
    expect(refusal(args(), plan({ to: product({ id: TO, status: "archived" }) }))).toMatch(/target product is archived/);
  });
  it("refuses a deleted target even when published", () => {
    expect(refusal(args(), plan({ to: product({ id: TO, deleted: true }) }))).toMatch(/target product is deleted/);
  });
  it("refuses a draft source and accepts an archived or published one", () => {
    expect(refusal(args(), plan({ from: product({ id: FROM, status: "draft" }) }))).toMatch(/source product is draft/);
    expect(refusal(args(), plan())).toBeNull();
    expect(refusal(args(), plan({ from: product({ id: FROM, status: "published" }) }))).toBeNull();
  });
  it("refuses unknown products and --order ids that are not non-deleted orders of the source", () => {
    expect(refusal(args(), plan({ from: null }))).toMatch(/source product .* not found/);
    expect(refusal(args(), plan({ to: null }))).toMatch(/target product .* not found/);
    expect(refusal(args({ orderIds: [O1, OTHER] }), plan({ orders: [order(O1, "Maya Ortiz")] }))).toMatch(new RegExp(`not a non-deleted order.*${OTHER}`));
  });
  it("a refused run never writes", async () => {
    const { d } = deps(plan({ to: product({ id: TO, status: "draft" }) }));
    expect(await moveOrders(d, args())).toEqual({ ok: false, reason: expect.stringMatching(/not published/) });
    expect(d.move).not.toHaveBeenCalled();
  });
});

describe("pnpm move-orders: runs", () => {
  it("moves every non-deleted order of the source and prints the ids and the target title", async () => {
    const { d, lines } = deps(plan());
    expect(await moveOrders(d, args())).toEqual({ ok: true, dryRun: false, planned: [O1, O2], moved: [O1, O2] });
    expect(d.move).toHaveBeenCalledWith(FROM, TO, undefined, { allowTypeChange: false });
    const out = lines.join("\n");
    expect(out).toContain(`moved 2 order(s) to "Grumpy Ivy Pot Tote by June"`);
    expect(out).toContain(O1);
    expect(out).not.toMatch(/Maya|Ortiz/);
  });

  it("--dry-run lists the orders with initials and writes nothing", async () => {
    const { d, lines } = deps(plan());
    expect(await moveOrders(d, args({ dryRun: true }))).toEqual({ ok: true, dryRun: true, planned: [O1, O2], moved: [] });
    expect(d.move).not.toHaveBeenCalled();
    const out = lines.join("\n");
    expect(out).toContain("would move 2 order(s)");
    expect(out).toContain(`${O1}  M. O.  placed  2026-10-30`);
    expect(out).toContain(`${O2}  S. L.  placed`);
    expect(out).not.toMatch(/Maya|Ortiz|sam|lee-park/);
    expect(out).toContain("nothing written");
  });

  it("--order passes the subset to the plan and the update", async () => {
    const { d } = deps(plan({ orders: [order(O2, "sam lee-park")] }));
    expect(await moveOrders(d, args({ orderIds: [O2] }))).toMatchObject({ ok: true, moved: [O2] });
    expect(d.getPlan).toHaveBeenCalledWith(FROM, TO, [O2]);
    expect(d.move).toHaveBeenCalledWith(FROM, TO, [O2], { allowTypeChange: false });
  });

  it("no orders on the source: nothing to move, no write", async () => {
    const { d, lines } = deps(plan({ orders: [] }));
    expect(await moveOrders(d, args())).toEqual({ ok: true, dryRun: false, planned: [], moved: [] });
    expect(d.move).not.toHaveBeenCalled();
    expect(lines.join("\n")).toContain("nothing to move");
  });

  it("reports planned orders the guarded update did not move", async () => {
    const { d } = deps(plan(), [O1]);
    expect(await moveOrders(d, args())).toEqual({ ok: false, reason: expect.stringMatching(new RegExp(`1 planned order\\(s\\) did not move.*${O2}`)) });
  });

  it("refuses a tote → sticker move unless --allow-type-change, which then warns and passes the flag on", async () => {
    const mismatched = plan({ to: product({ id: TO, type: "sticker" }) });
    const refused = deps(mismatched);
    expect(await moveOrders(refused.d, args())).toEqual({ ok: false, reason: expect.stringMatching(/tote and the target a sticker.*--allow-type-change/) });
    expect(refused.d.move).not.toHaveBeenCalled();
    const allowed = deps(mismatched);
    expect(await moveOrders(allowed.d, args({ allowTypeChange: true }))).toMatchObject({ ok: true, moved: [O1, O2] });
    expect(allowed.lines.join("\n")).toMatch(/warning: --allow-type-change: the source is a tote and the target a sticker/);
    expect(allowed.d.move).toHaveBeenCalledWith(FROM, TO, undefined, { allowTypeChange: true });
  });

  it("June's case: the two tote orders go to the new tote, the sticker order to the new sticker", async () => {
    const OLD_TOTE = "0cdb58d5-4922-49d8-8637-f1839e13a5e5", NEW_TOTE = "a5662b94-cfaa-45e9-8097-b2618a3ef275";
    const OLD_STICKER = "cf1aa9d7-7b36-4bf8-85e0-52883065aa81", NEW_STICKER = "0ffb1ff5-18fc-4de1-a577-bc46253c4966";
    const tote = deps(plan({ from: product({ id: OLD_TOTE, status: "archived" }), to: product({ id: NEW_TOTE }) }));
    expect(await moveOrders(tote.d, parseMoveOrdersArgs([OLD_TOTE, NEW_TOTE, "--dry-run"]))).toMatchObject({ ok: true, planned: [O1, O2] });
    const sticker = deps(plan({
      from: product({ id: OLD_STICKER, type: "sticker", status: "archived" }), to: product({ id: NEW_STICKER, type: "sticker" }),
      orders: [{ ...order(O1, "Maya Ortiz"), status: "printing" }],
    }));
    expect(await moveOrders(sticker.d, parseMoveOrdersArgs([OLD_STICKER, NEW_STICKER]))).toMatchObject({ ok: true, moved: [O1] });
    const crossed = deps(plan({ from: product({ id: OLD_STICKER, type: "sticker", status: "archived" }), to: product({ id: NEW_TOTE }) }));
    expect(await moveOrders(crossed.d, parseMoveOrdersArgs([OLD_STICKER, NEW_TOTE]))).toMatchObject({ ok: false });
  });
});

describe("moveOrdersToProduct (SQL)", () => {
  const updates = () => calls.filter((c) => c.sql.startsWith("update"));

  it("is one UPDATE that sets product_id only, with the guards in the statement", async () => {
    respond = (c) => (c.sql.startsWith("update") ? { rows: [[O1], [O2]] } : { rows: [] });
    expect(await moveOrdersToProduct(FROM, TO)).toEqual([O1, O2]);
    expect(calls).toHaveLength(1);
    const [u] = updates();
    const setClause = u.sql.slice(u.sql.indexOf(" set ") + 5, u.sql.indexOf(" where "));
    expect(setClause).toBe(`"product_id" = $1`);
    expect(u.params[0]).toBe(TO);
    const where = u.sql.slice(u.sql.indexOf(" where "));
    expect(where).toMatch(/"product_id" = \$\d/);
    expect(where).toMatch(/"deleted_at" is null/);
    expect(where).toMatch(/src\.creator_id = dst\.creator_id and dst\.creator_id = "orders"\."creator_id"/);
    expect(where).toMatch(/dst\.status = 'published' and dst\.deleted_at is null/);
    expect(where).toMatch(/src\.status in \('archived', 'published'\) and src\.type = dst\.type\)/);
    expect(where).not.toMatch(/"id" in/);
    expect(u.sql).toMatch(/returning "id"$/);
    expect(u.params).toEqual([TO, FROM, FROM, TO]);
    for (const col of ["amount_cents", "creator_share_cents", "org_share_cents", "status_updated_at", "buyer_name", "\"status\" ="]) expect(setClause).not.toContain(col);
  });

  it("allowTypeChange drops only the type check", async () => {
    await moveOrdersToProduct(FROM, TO, undefined, { allowTypeChange: true });
    const [u] = updates();
    expect(u.sql).not.toMatch(/src\.type = dst\.type/);
    expect(u.sql).toMatch(/dst\.status = 'published'/);
  });

  it("--order narrows the UPDATE to those ids; an empty subset issues no statement", async () => {
    await moveOrdersToProduct(FROM, TO, [O2]);
    const [u] = updates();
    expect(u.sql).toMatch(/"orders"\."id" in \(\$5\)|"id" in \(\$5\)/);
    expect(u.params[4]).toBe(O2);
    calls.length = 0;
    expect(await moveOrdersToProduct(FROM, TO, [])).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe("getMoveOrdersPlan (SQL, read only)", () => {
  it("reads both products (deleted ones flagged) and the source's non-deleted orders, without writing", async () => {
    respond = (c) => {
      if (c.sql.includes(`from "products"`)) return { rows: [[FROM, JUNE, "tote", "archived", null, "Old"], [TO, JUNE, "tote", "published", "2026-11-01T00:00:00Z", "New"]] };
      if (c.sql.includes(`from "orders"`)) return { rows: [[O1, "Maya Ortiz", "placed", "2026-10-30T12:00:00Z"]] };
      return { rows: [] };
    };
    const p = await getMoveOrdersPlan(FROM, TO, [O1]);
    expect(p.from).toEqual({ id: FROM, creatorId: JUNE, type: "tote", status: "archived", deleted: false, title: "Old" });
    expect(p.to).toMatchObject({ id: TO, deleted: true, title: "New" });
    expect(p.orders.map((o) => o.id)).toEqual([O1]);
    expect(calls.every((c) => c.sql.startsWith("select"))).toBe(true);
    const orderSelect = calls.find((c) => c.sql.includes(`from "orders"`))!;
    expect(orderSelect.sql).toMatch(/"orders"\."deleted_at" is null/);
    expect(orderSelect.params).toEqual([FROM, O1]);
  });
});
