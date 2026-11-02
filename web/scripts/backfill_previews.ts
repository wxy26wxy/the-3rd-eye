/**
 * Builds the public sticker preview (products.preview_url, T121) for every sticker product whose
 * artwork has a cleaned PNG and whose preview_url is null. Preview only: no mockup, no model
 * calls, no print-file rewrite. Idempotent (a second run finds nothing). Apply migration 0005 first.
 *   pnpm backfill:previews            # writes
 *   pnpm backfill:previews --dry-run  # lists what it would build, writes nothing
 */
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const q = await import("@/lib/db/queries");
  const { storage, creatorPath } = await import("@/lib/storage");
  const { backfillPreviews, renderStickerPreview } = await import("@/lib/pipeline/backfill-previews");
  const counts = await backfillPreviews({
    list: q.listStickersMissingPreview,
    read: (p) => storage().read(p),
    render: renderStickerPreview,
    put: async (creatorId, png) => (await storage().putPublic(creatorPath(creatorId, "previews", "png"), png, "image/png")).url,
    setIfMissing: q.setProductPreviewIfMissing,
    log: (line) => console.log(line),
  }, { dryRun });
  console.log(`stickers without a preview: ${counts.found}; built: ${counts.updated}; skipped: ${counts.skipped}; failed: ${counts.failed}${dryRun ? " (dry run, nothing written)" : ""}`);
  if (counts.failed > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
