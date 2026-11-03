/**
 * Replaces a creator's live sticker or tote with a founder-provided picture (T148, round 6) through the
 * app's own pipeline; see lib/pipeline/replace-art.ts. Prints the artwork id, the product id, the print
 * check and the shop URL only (never env values or creator codes).
 *   pnpm replace-art <slug> <file> <sticker|tote> [--box x0,y0,x1,y1] [--phrase "…"] [--title "…"] [--keep-old]
 *   pnpm replace-art … --dry-run   # SAM + the cut only; writes ./.replace-art/<slug>-<type>-{crop,cut}.png, no upload, no database
 */
async function main() {
  const { parseReplaceArtArgs, replaceArt, USAGE } = await import("@/lib/pipeline/replace-art");
  let args;
  try {
    args = parseReplaceArtArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    console.error(USAGE);
    process.exit(2);
  }
  // A dry run must not reach the database: without DATABASE_URL the model-call trace is not persisted either.
  if (args.dryRun) delete process.env.DATABASE_URL;
  const path = await import("node:path");
  const { mkdir, readFile, writeFile } = await import("node:fs/promises");
  // Relative paths are read and written from where the command was typed (pnpm runs this script from web/).
  const cwd = process.env.INIT_CWD ?? process.cwd();
  const q = () => import("@/lib/db/queries");
  const art = () => import("@/lib/pipeline/artworks");
  const prod = () => import("@/lib/pipeline/products");
  await replaceArt({
    readFile: (f) => readFile(path.resolve(cwd, f)),
    log: (line) => console.log(line),
    previewCut: async (png, phrases) => (await art()).previewFramedCut(png, { phrases, task: "T148" }),
    writeLocal: async (name, png) => {
      const dir = path.resolve(cwd, ".replace-art");
      await mkdir(dir, { recursive: true });
      const out = path.join(dir, name);
      await writeFile(out, png);
      return path.relative(cwd, out);
    },
    findCreator: async (slug) => (await q()).getCreatorBySlug(slug),
    uploadPhoto: async (creatorId, png) => {
      const { storage, creatorPath } = await import("@/lib/storage");
      return (await storage().putPublic(creatorPath(creatorId, "photo", "png"), png, "image/png")).url;
    },
    createFromImage: async (creatorId, input) => (await art()).createFromImage(creatorId, input, "T148"),
    createProduct: async (artwork, type) => (await prod()).createProduct(artwork as never, type, "T148"),
    runListingAgent: async (product, artwork) => (await prod()).runListingAgent(product as never, artwork as never, "T148"),
    approveListing: async (product, input) => (await prod()).approveListing(product as never, input, "T148"),
    listCreatorProducts: async (creatorId) => (await q()).listProductsByCreator(creatorId),
    listArtworkProducts: async (artworkId) => (await q()).listProductsForArtwork(artworkId),
    archiveArtwork: async (artworkId) => { await (await q()).deleteArtworkArchivingProducts(artworkId); },
    archiveProduct: async (productId) => { await (await q()).updateProduct(productId, { status: "archived" }); },
  }, args);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });

export {}; // a module, so main() does not clash with the other scripts in the type check
