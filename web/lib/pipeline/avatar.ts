/**
 * Creator portraits (T147): a centre-square crop stored publicly as `creators/<id>/avatar/<uuid>.jpg`
 * and written to `creators.avatar_url`. Used by `scripts/set_avatar.ts` (`pnpm avatar`) and by the
 * seed (only while the row has no avatar). Dependencies are injected so the logic is testable
 * without a network.
 */
import "server-only";

export const AVATAR_PX = 480;
export const AVATAR_QUALITY = 88;

/** Any image → AVATAR_PX × AVATAR_PX JPEG, centre-square crop, transparency flattened on white. */
export async function cropAvatar(image: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(image).rotate().flatten({ background: "#ffffff" })
    .resize(AVATAR_PX, AVATAR_PX, { fit: "cover", position: "centre" })
    .jpeg({ quality: AVATAR_QUALITY }).toBuffer();
}

export type SetAvatarDeps = {
  readFile(file: string): Promise<Buffer>;
  /** The creator's id by slug, or null when there is none. */
  findCreator(slug: string): Promise<{ id: string } | null>;
  /** Stores the JPEG publicly; returns its public URL. */
  put(creatorId: string, jpeg: Buffer): Promise<string>;
  /** Sets avatar_url; true when the row changed. */
  save(creatorId: string, url: string): Promise<boolean>;
  log(line: string): void;
};

export type SetAvatarResult = { slug: string; size: number; url: string | null };

/** `pnpm avatar <slug> <file> [--dry-run]`. A dry run crops and reports, and touches neither storage nor the database. */
export async function setAvatar(deps: SetAvatarDeps, args: { slug: string; file: string; dryRun?: boolean }): Promise<SetAvatarResult> {
  const jpeg = await cropAvatar(await deps.readFile(args.file));
  deps.log(`slug: ${args.slug}`);
  deps.log(`crop: ${AVATAR_PX}x${AVATAR_PX}`);
  if (args.dryRun) {
    deps.log("dry run: nothing uploaded, nothing written");
    return { slug: args.slug, size: AVATAR_PX, url: null };
  }
  const creator = await deps.findCreator(args.slug);
  if (!creator) throw new Error(`No creator with slug "${args.slug}"`);
  const url = await deps.put(creator.id, jpeg);
  if (!(await deps.save(creator.id, url))) throw new Error(`Could not update creator "${args.slug}"`);
  deps.log(`avatar: ${url}`);
  return { slug: args.slug, size: AVATAR_PX, url };
}

export type SeedAvatarDeps = {
  /** The portrait file, or null when the creator has none. */
  readFile(slug: string): Promise<Buffer | null>;
  put(creatorId: string, jpeg: Buffer): Promise<string>;
  /** Sets avatar_url only while it is still null; true when the row changed. */
  setIfMissing(creatorId: string, url: string): Promise<boolean>;
};

/**
 * The seed's avatar step: applied only when the row has no avatar_url (a re-run never overwrites a
 * photo set with `pnpm avatar`) and a portrait file exists for the slug. Returns what happened.
 */
export async function seedAvatar(deps: SeedAvatarDeps, creator: { id: string; slug: string; avatarUrl: string | null }): Promise<"set" | "kept" | "none"> {
  if (creator.avatarUrl) return "kept";
  const file = await deps.readFile(creator.slug);
  if (!file) return "none";
  const url = await deps.put(creator.id, await cropAvatar(file));
  return (await deps.setIfMissing(creator.id, url)) ? "set" : "kept";
}
