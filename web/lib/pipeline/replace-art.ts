/**
 * Replaces a creator's live sticker or tote with a founder-provided picture (T148, round 6), through the
 * same pipeline the app uses: the picture (normalised, upscaled ×2 when small, cropped to `--box`) is
 * stored as the creator's photo upload → `createFromImage {framed: true}` (SAM inside the crop, the
 * largest piece cut) → `createProduct` → `runListingAgent` → `approveListing {acceptPrintWarning: true}`
 * → the creator's previous published products of that type are archived (unless `--keep-old`).
 * Used by `scripts/replace_art.ts` (`pnpm replace-art`); every dependency is injected so the logic is
 * testable without a network. `--dry-run` stops after the cutout and writes nothing but two local PNGs.
 */
import "server-only";
import sharp from "sharp";
import { ensureDpi } from "@/lib/image/sticker";

export type ProductType = "sticker" | "tote";
/** Fractions of the picture, [x0, y0, x1, y1], 0 ≤ x0 < x1 ≤ 1. */
export type FractionBox = [number, number, number, number];

export type ReplaceArtArgs = {
  slug: string; file: string; type: ProductType;
  box?: FractionBox; phrases: string[]; title?: string; dryRun: boolean; keepOld: boolean;
};

/** The shop the product link is printed for. */
export const SHOP_BASE = "https://the-3rd-eye.vercel.app";
/** Longest side of the normalised picture. */
export const MAX_SIDE = 4096;
/** Ruling 4: a source whose short side is under this is upscaled (×2 at most, Lanczos) before the crop. */
export const SOURCE_MIN_SHORT_SIDE = 1800;
/** The app's SAM phrases (SAM_PHRASES), shown in the log when no `--phrase` is given. */
export const DEFAULT_PHRASES = ["drawing", "handmade object"] as const;

export const USAGE =
  "usage: pnpm replace-art <slug> <file> <sticker|tote> [--box x0,y0,x1,y1] [--phrase \"…\"] [--title \"…\"] [--dry-run] [--keep-old]\n" +
  "  --box     the area to cut from, as fractions of the picture (0..1), e.g. 0.1,0.2,0.9,0.95\n" +
  "  --phrase  what SAM looks for instead of \"drawing\" + \"handmade object\"; repeat it for several (the largest piece is cut)\n" +
  "  --dry-run cut out only and write ./.replace-art/<slug>-<type>-{crop,cut}.png; no upload, no database";

/** Parses `x0,y0,x1,y1` (fractions); throws on anything else. */
export function parseBox(text: string): FractionBox {
  const parts = text.split(",").map((p) => p.trim());
  const nums = parts.map(Number);
  if (parts.length !== 4 || parts.some((p) => p === "") || nums.some((n) => !Number.isFinite(n))) {
    throw new Error(`--box needs four numbers x0,y0,x1,y1 (got "${text}")`);
  }
  const [x0, y0, x1, y1] = nums;
  if ([x0, y0, x1, y1].some((n) => n < 0 || n > 1)) throw new Error("--box values are fractions between 0 and 1");
  if (x1 <= x0 || y1 <= y0) throw new Error("--box needs x0 < x1 and y0 < y1");
  return [x0, y0, x1, y1];
}

/** `process.argv.slice(2)` → arguments; throws with a message (the caller prints USAGE). */
export function parseReplaceArtArgs(argv: string[]): ReplaceArtArgs {
  const positional: string[] = [];
  let box: FractionBox | undefined, title: string | undefined;
  const phrases: string[] = [];
  let dryRun = false, keepOld = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === "--dry-run") dryRun = true;
    else if (a === "--keep-old") keepOld = true;
    else if (a === "--box") box = parseBox(value());
    else if (a === "--phrase") { const p = value().trim(); if (p && !phrases.includes(p)) phrases.push(p); }
    else if (a === "--title") title = value().trim() || undefined;
    else if (a.startsWith("--")) throw new Error(`unknown option ${a}`);
    else positional.push(a);
  }
  if (positional.length !== 3) throw new Error("need <slug> <file> <sticker|tote>");
  const [slug, file, type] = positional;
  if (type !== "sticker" && type !== "tote") throw new Error(`the product type is sticker or tote (got "${type}")`);
  return { slug, file, type, box, phrases, title, dryRun, keepOld };
}

/**
 * The pixel rectangle of a fraction box on a w × h picture: edges rounded outward (floor/ceil), clamped
 * to the picture, at least 1 px wide and high.
 */
export function boxToPixels(box: FractionBox, w: number, h: number): { left: number; top: number; width: number; height: number } {
  const left = Math.max(0, Math.min(w - 1, Math.floor(box[0] * w)));
  const top = Math.max(0, Math.min(h - 1, Math.floor(box[1] * h)));
  const right = Math.max(left + 1, Math.min(w, Math.ceil(box[2] * w)));
  const bottom = Math.max(top + 1, Math.min(h, Math.ceil(box[3] * h)));
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * SAM phrases for the run: the app's default pair, or the `--phrase` values instead (the largest piece of
 * all of them is cut). Dry runs 2026-11-03: inside a box around the cactus "drawing" found the cactus with
 * its pot and "cactus in a pot" the cactus alone; on the ivy box "drawing" found the whole box and
 * "ivy plant in a pot" the plant, pot and vines. So the phrases are chosen per picture, not fixed slots.
 */
export function phrasesFor(phrases: readonly string[]): readonly string[] | undefined {
  return phrases.length ? phrases : undefined;
}

/**
 * The picture as uploaded: EXIF-oriented, flattened on white, at most MAX_SIDE, upscaled ×2 at most (Lanczos,
 * `ensureDpi`) when its short side is under SOURCE_MIN_SHORT_SIDE, then cropped to `box` (PNG).
 */
export async function preparePicture(raw: Buffer, box?: FractionBox): Promise<{ png: Buffer; width: number; height: number; upscale: number }> {
  const flat = await sharp(raw).rotate().flatten({ background: "#ffffff" })
    .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const before = await sharp(flat).metadata();
  const up = await ensureDpi(flat, SOURCE_MIN_SHORT_SIDE);
  const meta = await sharp(up).metadata();
  const W = meta.width ?? 0, H = meta.height ?? 0;
  const upscale = before.width ? Math.round((W / before.width) * 100) / 100 : 1;
  if (!box) return { png: up, width: W, height: H, upscale };
  const r = boxToPixels(box, W, H);
  return { png: await sharp(up).extract(r).png().toBuffer(), width: r.width, height: r.height, upscale };
}

type Row = { id: string };
type ProductLike = Row & { type: string; status: string; artworkId: string };
type PrintCheckLike = { print_ok?: boolean; check?: string | null; resolution?: { ok?: boolean; message?: string }; contrast?: { ok?: boolean; message?: string } } | null | undefined;

export type ReplaceArtDeps = {
  readFile(file: string): Promise<Buffer>;
  log(line: string): void;
  /** Dry run: SAM + the cut on the picture, no storage, no database. */
  previewCut(png: Buffer, phrases?: readonly string[]): Promise<{ cleaned: Buffer; pieces: number }>;
  /** Dry run: writes a local file (`name` is `<slug>-<type>-crop.png` / `-cut.png`); returns where. */
  writeLocal(name: string, png: Buffer): Promise<string>;
  findCreator(slug: string): Promise<Row | null>;
  /** Stores the picture as the creator's public photo upload; returns the URL `createFromImage` reads. */
  uploadPhoto(creatorId: string, png: Buffer): Promise<string>;
  createFromImage(creatorId: string, input: { source: "photo"; imageUrl: string; product: ProductType; framed: true; phrases?: readonly string[] }): Promise<{ artwork: Row & { cleanedUrl?: string | null } }>;
  createProduct(artwork: Row, type: ProductType): Promise<ProductLike>;
  runListingAgent(product: ProductLike, artwork: Row): Promise<{ row: { printCheck?: unknown } }>;
  approveListing(product: ProductLike, input: { approvedVia: "tap"; acceptPrintWarning: true; edits?: { title?: string } }): Promise<{ product: ProductLike; listing: { printCheck?: unknown } }>;
  /** Every live (not deleted) product of the creator. */
  listCreatorProducts(creatorId: string): Promise<ProductLike[]>;
  /** Live (not archived) products of one artwork. */
  listArtworkProducts(artworkId: string): Promise<ProductLike[]>;
  /** Soft-deletes the artwork and archives its products (the app's "Delete design"). */
  archiveArtwork(artworkId: string): Promise<void>;
  /** Archives one product only (its artwork also carries a live product of another type). */
  archiveProduct(productId: string): Promise<void>;
};

export type ReplaceArtResult =
  | { dryRun: true; cropPath: string; cutPath: string; pieces: number }
  | { dryRun: false; artworkId: string; productId: string; printCheck: string; shopUrl: string; archived: string[] };

/** One line for the print check: "ok", "contrast warning (accepted)" or "resolution: <message>". */
export function describePrintCheck(pc: PrintCheckLike): string {
  if (!pc) return "not measured";
  if (pc.resolution && pc.resolution.ok === false) return `resolution: ${pc.resolution.message ?? "too small to print"}`;
  if (pc.check === "contrast") return "contrast warning (accepted)";
  return pc.print_ok === false ? `failed (${pc.check ?? "unknown"})` : "ok";
}

/**
 * The archive rule: the creator's other PUBLISHED products of `type` (never `keepId`). An artwork whose
 * live products are all of `type` is soft-deleted (its products archived); one that also carries another
 * type keeps that product, so only the matching product is archived. Returns the archived product ids.
 */
export async function archivePrevious(
  deps: Pick<ReplaceArtDeps, "listCreatorProducts" | "listArtworkProducts" | "archiveArtwork" | "archiveProduct">,
  creatorId: string, type: ProductType, keepId: string,
): Promise<string[]> {
  const old = (await deps.listCreatorProducts(creatorId)).filter((p) => p.type === type && p.status === "published" && p.id !== keepId);
  const archived: string[] = [];
  const doneArtworks = new Set<string>();
  for (const p of old) {
    if (doneArtworks.has(p.artworkId)) continue;
    const siblings = await deps.listArtworkProducts(p.artworkId);
    if (siblings.every((s) => s.type === type)) {
      await deps.archiveArtwork(p.artworkId);
      doneArtworks.add(p.artworkId);
      archived.push(...old.filter((o) => o.artworkId === p.artworkId).map((o) => o.id));
    } else {
      await deps.archiveProduct(p.id);
      archived.push(p.id);
    }
  }
  return archived;
}

export async function replaceArt(deps: ReplaceArtDeps, args: ReplaceArtArgs): Promise<ReplaceArtResult> {
  const pic = await preparePicture(await deps.readFile(args.file), args.box);
  const phrases = phrasesFor(args.phrases);
  deps.log(`picture: ${pic.width}x${pic.height}${pic.upscale > 1 ? ` (upscaled x${pic.upscale})` : ""}${args.box ? ` (box ${args.box.join(",")})` : ""}`);
  deps.log(`phrases: ${(phrases ?? DEFAULT_PHRASES).join(" + ")}`);
  if (args.dryRun) {
    const cut = await deps.previewCut(pic.png, phrases);
    const base = `${args.slug}-${args.type}`;
    const cropPath = await deps.writeLocal(`${base}-crop.png`, pic.png);
    const cutPath = await deps.writeLocal(`${base}-cut.png`, cut.cleaned);
    const meta = await sharp(cut.cleaned).metadata();
    deps.log(`pieces found: ${cut.pieces}; cut (largest): ${meta.width}x${meta.height}`);
    deps.log(`crop: ${cropPath}`);
    deps.log(`cut: ${cutPath}`);
    deps.log("dry run: nothing uploaded, nothing written to the database, slug not checked");
    return { dryRun: true, cropPath, cutPath, pieces: cut.pieces };
  }
  const creator = await deps.findCreator(args.slug);
  if (!creator) throw new Error(`no creator with slug ${args.slug}`);
  const imageUrl = await deps.uploadPhoto(creator.id, pic.png);
  const { artwork } = await deps.createFromImage(creator.id, { source: "photo", imageUrl, product: args.type, framed: true, ...(phrases ? { phrases } : {}) });
  if (!artwork.cleanedUrl) throw new Error(`artwork ${artwork.id}: no cutout was made`);
  deps.log(`artwork: ${artwork.id}`);
  const product = await deps.createProduct(artwork, args.type);
  deps.log(`product: ${product.id}`);
  const agent = await deps.runListingAgent(product, artwork);
  let published: { product: ProductLike; listing: { printCheck?: unknown } };
  try {
    published = await deps.approveListing(product, { approvedVia: "tap", acceptPrintWarning: true, ...(args.title ? { edits: { title: args.title } } : {}) });
  } catch (e) {
    deps.log(`print check: ${describePrintCheck(agent.row.printCheck as PrintCheckLike)}`);
    deps.log("not published; the previous products were kept");
    throw e;
  }
  const printCheck = describePrintCheck(published.listing.printCheck as PrintCheckLike);
  deps.log(`print check: ${printCheck}`);
  const archived = args.keepOld ? [] : await archivePrevious(deps, creator.id, args.type, product.id);
  deps.log(args.keepOld ? "previous products kept (--keep-old)" : `archived previous ${args.type}s: ${archived.length ? archived.join(", ") : "none"}`);
  const shopUrl = `${SHOP_BASE}/p/${product.id}`;
  deps.log(`shop: ${shopUrl}`);
  return { dryRun: false, artworkId: artwork.id, productId: product.id, printCheck, shopUrl, archived };
}
