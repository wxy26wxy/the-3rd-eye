/**
 * Sets a creator's portrait (T147): centre-square crop 480×480 JPEG → public storage
 * (`creators/<id>/avatar/<uuid>.jpg`) → creators.avatar_url. Prints the slug, the crop size and the
 * new URL only. Overwrites an existing avatar (the seed never does).
 *   pnpm avatar <slug> <file>            # writes
 *   pnpm avatar <slug> <file> --dry-run  # crops and reports; no upload, no database call
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const [slug, file] = args.filter((a) => a !== "--dry-run");
  if (!slug || !file) {
    console.error("usage: pnpm avatar <slug> <file> [--dry-run]");
    process.exit(2);
  }
  const path = await import("node:path");
  const { readFile } = await import("node:fs/promises");
  const { setAvatar } = await import("@/lib/pipeline/avatar");
  // A relative file is read from where the command was typed (pnpm runs this script from web/).
  const resolved = path.resolve(process.env.INIT_CWD ?? process.cwd(), file);
  await setAvatar({
    readFile: (f) => readFile(f),
    findCreator: async (s) => (await import("@/lib/db/queries")).getCreatorBySlug(s),
    put: async (creatorId, jpeg) => {
      const { storage, creatorPath } = await import("@/lib/storage");
      return (await storage().putPublic(creatorPath(creatorId, "avatar", "jpg"), jpeg, "image/jpeg")).url;
    },
    save: async (creatorId, url) => Boolean(await (await import("@/lib/db/queries")).updateCreator(creatorId, { avatarUrl: url })),
    log: (line) => console.log(line),
  }, { slug, file: resolved, dryRun });
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });

export {}; // a module, so main() does not clash with the other scripts in the type check
