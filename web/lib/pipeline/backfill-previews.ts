/**
 * Backfill of the public sticker preview (T121) for stickers made before `products.preview_url`
 * existed. Preview only: one composeSticker per product from the stored cleaned PNG; no mockup,
 * no model calls, the print files are not rewritten. Idempotent: only rows whose preview_url is
 * null are picked, and the write is conditional on it still being null.
 * Dependencies are injected so the selection and idempotence logic is testable without a network.
 */
import "server-only";

export type BackfillCandidate = { productId: string; creatorId: string; cleanedUrl: string };

export type BackfillDeps = {
  /** Sticker products with a cleaned artwork and no preview_url. */
  list(): Promise<BackfillCandidate[]>;
  read(pathOrUrl: string): Promise<Buffer>;
  /** Cleaned PNG → bordered preview PNG. */
  render(cleanedPng: Buffer): Promise<Buffer>;
  /** Stores the preview publicly; returns its public URL. */
  put(creatorId: string, png: Buffer): Promise<string>;
  /** Sets preview_url while it is still null; true when the row changed. */
  setIfMissing(productId: string, url: string): Promise<boolean>;
  log?(line: string): void;
};

export type BackfillCounts = { found: number; updated: number; skipped: number; failed: number; dryRun: boolean };

export async function backfillPreviews(deps: BackfillDeps, opts: { dryRun?: boolean } = {}): Promise<BackfillCounts> {
  const dryRun = Boolean(opts.dryRun);
  const log = deps.log ?? (() => {});
  const rows = await deps.list();
  const counts: BackfillCounts = { found: rows.length, updated: 0, skipped: 0, failed: 0, dryRun };
  for (const row of rows) {
    if (dryRun) { log(`would build: ${row.productId}`); continue; }
    try {
      const png = await deps.render(await deps.read(row.cleanedUrl));
      const url = await deps.put(row.creatorId, png);
      if (await deps.setIfMissing(row.productId, url)) { counts.updated++; log(`built: ${row.productId}`); }
      else { counts.skipped++; log(`skipped (already has a preview): ${row.productId}`); }
    } catch (e) {
      counts.failed++;
      log(`failed: ${row.productId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return counts;
}

/** The preview PNG of a sticker from its cleaned PNG (the same composeSticker as the print file). */
export async function renderStickerPreview(cleanedPng: Buffer): Promise<Buffer> {
  const { composeSticker } = await import("@/lib/image/sticker");
  const { PRINT_SPECS } = await import("@/lib/products/registry");
  const files = await composeSticker(cleanedPng, { borderMm: PRINT_SPECS.sticker.borderMm, bleedMm: PRINT_SPECS.sticker.bleedMm });
  return files.previewPng;
}
