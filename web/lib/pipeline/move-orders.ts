/**
 * Re-points a creator's orders from an archived (or still published) product to its replacement (T149,
 * round 6): June Park's orders on her archived seeded tote and sticker must show the new tote and sticker
 * in the iOS Orders inbox, the admin orders table and the story-tag page without deleting history.
 * `orders.product_id` changes, plus a `statusUpdatedAt` bump (see `moveOrdersToProduct`); sticker orders go to a sticker and tote orders
 * to a tote unless `--allow-type-change`. Used by `scripts/move_orders.ts` (`pnpm move-orders`); the
 * database calls are injected so the logic is testable without one. `--dry-run` reads and lists only;
 * buyer names are shown as initials, emails never.
 */
import type { MoveOrdersCandidate, MoveOrdersProduct } from "@/lib/db/queries";

export type MoveOrdersArgs = {
  fromProductId: string; toProductId: string; orderIds?: string[]; dryRun: boolean; allowTypeChange: boolean;
};

export const USAGE =
  "usage: pnpm move-orders <from-product-id> <to-product-id> [--order <order-id>]... [--dry-run] [--allow-type-change]\n" +
  "  --order   move only this order of the source product (repeat it for several); default: every non-deleted order\n" +
  "  --dry-run list the orders that would move (buyer names as initials) and write nothing\n" +
  "  --allow-type-change  move orders between a sticker and a tote (refused by default; sizes on the orders stay)";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `process.argv.slice(2)` → arguments; throws with a message (the caller prints USAGE). */
export function parseMoveOrdersArgs(argv: string[]): MoveOrdersArgs {
  const positional: string[] = [];
  const orderIds: string[] = [];
  let dryRun = false, allowTypeChange = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--allow-type-change") allowTypeChange = true;
    else if (a === "--order") {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error("--order needs an order id");
      orderIds.push(v);
    } else if (a.startsWith("--")) throw new Error(`unknown option ${a}`);
    else positional.push(a);
  }
  if (positional.length !== 2) throw new Error("give the source product id and the target product id");
  const ids = [...positional, ...orderIds];
  const bad = ids.find((id) => !UUID.test(id));
  if (bad !== undefined) throw new Error(`not a full id (uuid): ${bad}`);
  const [fromProductId, toProductId] = positional.map((id) => id.toLowerCase());
  if (fromProductId === toProductId) throw new Error("the source and target products are the same");
  return {
    fromProductId, toProductId, dryRun, allowTypeChange,
    orderIds: orderIds.length ? [...new Set(orderIds.map((id) => id.toLowerCase()))] : undefined,
  };
}

/** "Maya Ortiz" → "M. O."; a buyer name is never printed whole. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.map((p) => `${[...p][0]!.toUpperCase()}.`).join(" ") : "?";
}

export type MoveOrdersPlan = { from: MoveOrdersProduct | null; to: MoveOrdersProduct | null; orders: MoveOrdersCandidate[] };

/** The ruling's guards, on the plan; returns the reason to refuse, or null. */
export function refusal(args: MoveOrdersArgs, plan: MoveOrdersPlan): string | null {
  const { from, to } = plan;
  if (!from) return `source product ${args.fromProductId} not found`;
  if (!to) return `target product ${args.toProductId} not found`;
  if (from.creatorId !== to.creatorId) return "the two products belong to different creators";
  if (to.deleted) return "the target product is deleted";
  if (to.status !== "published") return `the target product is ${to.status}, not published`;
  if (from.status !== "archived" && from.status !== "published") return `the source product is ${from.status}; only archived or published products can hand over orders`;
  if (from.type !== to.type && !args.allowTypeChange) return `the source is a ${from.type} and the target a ${to.type}; pass --allow-type-change to move orders across types`;
  if (args.orderIds) {
    const found = new Set(plan.orders.map((o) => o.id));
    const missing = args.orderIds.filter((id) => !found.has(id));
    if (missing.length) return `not a non-deleted order of the source product: ${missing.join(", ")}`;
  }
  return null;
}

export type MoveOrdersDeps = {
  getPlan: (from: string, to: string, orderIds?: string[]) => Promise<MoveOrdersPlan>;
  move: (from: string, to: string, orderIds: string[] | undefined, opts: { allowTypeChange: boolean }) => Promise<string[]>;
  log: (line: string) => void;
};

export type MoveOrdersResult =
  | { ok: false; reason: string }
  | { ok: true; dryRun: boolean; planned: string[]; moved: string[] };

const label = (p: MoveOrdersProduct) => `"${p.title ?? "(no listing title)"}" (${p.type}, ${p.status}${p.deleted ? ", deleted" : ""})`;

export async function moveOrders(deps: MoveOrdersDeps, args: MoveOrdersArgs): Promise<MoveOrdersResult> {
  const plan = await deps.getPlan(args.fromProductId, args.toProductId, args.orderIds);
  const reason = refusal(args, plan);
  if (reason) return { ok: false, reason };
  const from = plan.from!, to = plan.to!;
  const planned = plan.orders.map((o) => o.id);
  deps.log(`from ${from.id} ${label(from)}`);
  deps.log(`to   ${to.id} ${label(to)}`);
  if (from.deleted) deps.log("warning: the source product is soft-deleted; its orders still move");
  if (from.type !== to.type) deps.log(`warning: --allow-type-change: the source is a ${from.type} and the target a ${to.type}; sizes on the orders stay as they are`);
  if (!planned.length) {
    deps.log("no non-deleted orders on the source product; nothing to move");
    return { ok: true, dryRun: args.dryRun, planned, moved: [] };
  }
  if (args.dryRun) {
    deps.log(`dry run: would move ${planned.length} order(s):`);
    for (const o of plan.orders) deps.log(`  ${o.id}  ${initials(o.buyerName)}  ${o.status}  ${o.createdAt.toISOString().slice(0, 10)}`);
    deps.log("nothing written");
    return { ok: true, dryRun: true, planned, moved: [] };
  }
  // Bounded to the orders just listed, so an order placed after the check is not moved unseen.
  const moved = await deps.move(args.fromProductId, args.toProductId, args.orderIds ?? planned, { allowTypeChange: args.allowTypeChange });
  deps.log(`moved ${moved.length} order(s) to "${to.title ?? "(no listing title)"}":`);
  for (const id of moved) deps.log(`  ${id}`);
  if (moved.length !== planned.length) {
    const left = planned.filter((id) => !moved.includes(id));
    return { ok: false, reason: `moved ${moved.length} of ${planned.length} planned order(s) (a product or order changed since the check); not moved: ${left.join(", ") || "none"}` };
  }
  return { ok: true, dryRun: false, planned, moved };
}
