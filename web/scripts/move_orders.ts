/**
 * Re-points a creator's orders from an archived product to its replacement (T149, round 6); see
 * lib/pipeline/move-orders.ts. Changes `orders.product_id` (+ a `statusUpdatedAt` bump). Prints the product ids and titles and
 * the order ids (a dry run adds buyer initials, status and date); never env values, codes or emails.
 *   pnpm move-orders <from-product-id> <to-product-id> [--order <order-id>]... [--allow-type-change]
 *   pnpm move-orders … --dry-run   # reads and lists only; writes nothing
 */
async function main() {
  const { moveOrders, parseMoveOrdersArgs, USAGE } = await import("@/lib/pipeline/move-orders");
  let args;
  try {
    args = parseMoveOrdersArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    console.error(USAGE);
    process.exit(2);
  }
  const q = await import("@/lib/db/queries");
  const result = await moveOrders({
    getPlan: (from, to, ids) => q.getMoveOrdersPlan(from, to, ids),
    // A dry run never reaches the write, even by mistake.
    move: args.dryRun ? async () => { throw new Error("dry run: no write"); } : (from, to, ids, opts) => q.moveOrdersToProduct(from, to, ids, opts),
    log: (line) => console.log(line),
  }, args);
  if (!result.ok) {
    console.error(`refused: ${result.reason}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });

export {}; // a module, so main() does not clash with the other scripts in the type check
