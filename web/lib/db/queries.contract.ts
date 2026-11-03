/**
 * Web data contract.
 *
 * Pages, server actions and route handlers in the web workstream import data ONLY from
 * this module. It keeps the shapes the pages were built against and maps them from
 * `lib/db/queries.ts` (reads) and `lib/pipeline/*` (writes: orders, taps, replies), so the
 * pages never see database rows directly. Bound to the real backend in T040.
 */
import "server-only";
import { connection } from "next/server";
import type { InferSelectModel } from "drizzle-orm";
import type { aiCalls, artworks, creators } from "./schema";
import * as q from "./queries";
import { placeOrder, sendReply, tap } from "@/lib/pipeline/public";
import { isNfcToken, normalizeNfcToken } from "@/lib/ids";
import { featuredSlug, findFeatured, leadWithFeatured } from "@/lib/creators/featured";

type CreatorRow = InferSelectModel<typeof creators>;
type ArtworkRow = InferSelectModel<typeof artworks>;
export type AiCallRow = InferSelectModel<typeof aiCalls>;

export type ProductType = "sticker" | "tote";
export type OrderStatus = "placed" | "printing" | "shipped" | "delivered";
export const ORDER_STATUSES: OrderStatus[] = ["placed", "printing", "shipped", "delivered"];
export type ShopFilter = "all" | "sticker" | "tote";

export type PublicCreator = Pick<
  CreatorRow,
  | "id" | "slug" | "displayName" | "studioName" | "avatarUrl" | "bioShort" | "storyText"
  | "storyVideoUrl" | "storyVideoVtt" | "mentionDisability" | "split" | "isExample" | "hidden"
>;
export type CreatorSummary = Pick<
  PublicCreator, "id" | "slug" | "displayName" | "studioName" | "avatarUrl" | "split" | "isExample" | "bioShort"
>;

/** A published product with its approved listing, as shown in the shop. */
export type ShopProduct = {
  id: string;
  type: ProductType;
  title: string;
  description: string | null;
  priceCents: number;
  mockupUrl: string | null;
  /** Public bordered sticker preview PNG (products.previewUrl, T121; null for totes and not-yet-backfilled stickers). */
  previewUrl: string | null;
  /** Public cleaned artwork PNG (artworks.cleanedUrl). */
  artworkUrl: string | null;
  /** SVG path data of the die-cut line (artworks.cutPathSvg). */
  cutPathSvg: string | null;
  altText: string | null;
  madeByVoice: boolean;
  tags: string[];
  creator: CreatorSummary;
};
export type ProductDetail = Omit<ShopProduct, "creator"> & {
  artworkId: string;
  spokenDescription: string | null;
  creator: PublicCreator;
};
export type CreatorProfile = PublicCreator & { products: ShopProduct[] };
/** The creator's thank-you for this order. `imageUrl` is a public URL or a pathname served via /media?tag=. */
export type TagThankYou = { text: string | null; imageUrl: string | null; videoUrl: string | null; videoVtt: string | null };
export type TagMessage = { id: string; direction: "buyer_to_creator" | "creator_to_buyer"; body: string; createdAt: Date };
export type StoryTagView = {
  token: string;
  tapCount: number;
  productTitle: string;
  product: ShopProduct | null;
  creator: PublicCreator;
  moreFromStudio: ShopProduct[];
  thankYou: TagThankYou | null;
  /** Notes between the buyer and the creator on this order, oldest first. */
  messages: TagMessage[];
};
/** `size`: sticker size key (default "3in"; none for totes); `quantity` 1–10 (default 1). See lib/products/sizes.ts. */
export type OrderInput = { buyerName: string; buyerEmail?: string; shipNote?: string; size?: string; quantity?: number };
export type OrderConfirmation = { orderId: string; token: string; productTitle: string; creatorName: string };
export type AdminCreator = {
  id: string; slug: string; displayName: string; studioName: string | null;
  isExample: boolean; hidden: boolean; publishedProducts: number; createdAt: Date;
};
/** A freshly issued code, shown once on /admin and never stored anywhere else. */
export type IssuedCode = { creatorId: string; displayName: string; code: string };
export type NewCreatorInput = { displayName: string; studioName?: string; mentionDisability?: boolean; hidden?: boolean };
export type AdminOrder = {
  id: string;
  status: OrderStatus;
  buyerName: string;
  buyerEmail: string | null;
  shipNote: string | null;
  /** Sticker size key, null for totes and orders placed before v0.8. */
  size: string | null;
  quantity: number;
  amountCents: number;
  creatorShareCents: number;
  createdAt: Date;
  product: {
    id: string; title: string; type: ProductType; mockupUrl: string | null;
    /** Private blob pathnames; served through /media/{pathname}. */
    printPngUrl: string | null; printSvgUrl: string | null; artworkId: string;
  };
  creator: { displayName: string; slug: string };
  token: string | null;
  tapCount: number;
  /** Notes between buyer and creator on this order, oldest first. */
  messages: { id: string; direction: "buyer_to_creator" | "creator_to_buyer"; body: string; createdAt: Date }[];
};
/** One image in the trace chain (a generated variant or a SAM candidate). */
export type TraceImage = { id: string; url: string | null; altText: string | null; chosen: boolean };
/** One "Change it" step in the chain (T111): the request and the pictures before and after it. */
export type TraceChange = {
  id: string; instruction: string; transcript: string | null;
  beforeUrl: string | null; afterUrl: string | null; differences: string | null;
};
export type ArtworkTrace = {
  artwork: Pick<
    ArtworkRow,
    | "id" | "source" | "transcript" | "shapedPrompt" | "originalUrl" | "cleanedUrl" | "maskUrl" | "cutPathSvg"
    | "altText" | "spokenDescription" | "differencesFromPrompt" | "parentArtworkId" | "changeInstruction" | "createdAt"
  >;
  /** The photo the chain started from (the artwork itself when it is not a change result). */
  photo: { originalUrl: string | null; maskUrl: string | null };
  /** "Change it" steps, oldest first; empty when the artwork was not changed. */
  changes: TraceChange[];
  /** text2image: every variant from the same generation plus refine ancestors; `chosen` marks this artwork. */
  variants: TraceImage[];
  /** photo/canvas: SAM candidates (artworks.candidates); `chosen` marks the selected one when known. */
  candidates: TraceImage[];
  calls: AiCallRow[];
};
type WriteOpts = { task: string };

/** Shop data must be fresh per request (new listings appear immediately). */
const fresh = () => connection();

// ---------------------------------------------------------------- mapping

function toPublicCreator(c: q.CreatorRow): PublicCreator {
  return {
    id: c.id, slug: c.slug, displayName: c.displayName, studioName: c.studioName, avatarUrl: c.avatarUrl,
    bioShort: c.bioShort, storyText: c.storyText, storyVideoUrl: c.storyVideoUrl, storyVideoVtt: c.storyVideoVtt,
    mentionDisability: c.mentionDisability, split: c.split, isExample: c.isExample, hidden: c.hidden,
  };
}

function toCreatorSummary(c: q.CreatorRow): CreatorSummary {
  return {
    id: c.id, slug: c.slug, displayName: c.displayName, studioName: c.studioName, avatarUrl: c.avatarUrl,
    split: c.split, isExample: c.isExample, bioShort: c.bioShort,
  };
}

function toShopFields(r: q.ShopProduct): Omit<ShopProduct, "creator"> {
  return {
    id: r.product.id,
    type: r.product.type,
    title: r.listing?.title ?? "",
    description: r.listing?.description ?? null,
    priceCents: r.product.priceCents,
    mockupUrl: r.product.mockupUrl,
    previewUrl: r.product.previewUrl ?? null,
    artworkUrl: r.artwork.cleanedUrl,
    cutPathSvg: r.artwork.cutPathSvg,
    altText: r.artwork.altText,
    madeByVoice: r.listing?.madeByVoice ?? r.artwork.source === "text2image",
    tags: r.listing?.tags ?? [],
  };
}

const toShopProduct = (r: q.ShopProduct): ShopProduct => ({ ...toShopFields(r), creator: toCreatorSummary(r.creator) });

const traceImage = (a: q.ArtworkRow, chosenId: string): TraceImage => ({
  id: a.id, url: a.cleanedUrl, altText: a.altText, chosen: a.id === chosenId,
});

// ---------------------------------------------------------------- reads

export async function listShopProducts(filter: ShopFilter = "all"): Promise<ShopProduct[]> {
  await fresh();
  const rows = await q.listPublishedProducts(
    filter === "all" ? {} : { type: filter },
  );
  return rows.map(toShopProduct);
}

export async function getProductDetail(id: string): Promise<ProductDetail | null> {
  await fresh();
  if (!isUuid(id)) return null;
  const r = await q.getPublicProduct(id);
  if (!r) return null;
  return { ...toShopFields(r), artworkId: r.artwork.id, spokenDescription: r.artwork.spokenDescription, creator: toPublicCreator(r.creator) };
}

export async function listPublicCreators(): Promise<CreatorSummary[]> {
  await fresh();
  return (await q.listCreators()).map(toCreatorSummary);
}

/**
 * The creator featured on the shop (hero chip, phone preview): `FEATURED_CREATOR_SLUG` (default
 * "june-park", T147) when that creator is public; otherwise the most recent creator with a story
 * video; until anyone has one, the most recent creator with a published product; else the first
 * public creator.
 */
export async function getFeaturedCreator(): Promise<PublicCreator | null> {
  await fresh();
  const all = await q.listCreators();
  const featured = findFeatured(all, featuredSlug());
  if (featured) return toPublicCreator(featured);
  const withVideo = all.filter((c) => c.storyVideoUrl).sort((a, b) => +b.createdAt - +a.createdAt)[0];
  if (withVideo) return toPublicCreator(withVideo);
  const [latest] = await q.listPublishedProducts({ limit: 1 });
  if (latest) return toPublicCreator(latest.creator);
  return all[0] ? toPublicCreator(all[0]) : null;
}

/**
 * MEET THE MAKERS on the shop (v3, 2018:1937): up to `limit` public creators, the featured creator
 * (`FEATURED_CREATOR_SLUG`, T147) first, then those with a story video, then real before example
 * creators, newest first (the order `listCreators` already returns).
 */
export async function listMakers(limit = 3): Promise<PublicCreator[]> {
  await fresh();
  const all = await q.listCreators();
  const ranked = [...all.filter((c) => c.storyVideoUrl), ...all.filter((c) => !c.storyVideoUrl)];
  return leadWithFeatured(ranked, featuredSlug()).slice(0, limit).map(toPublicCreator);
}

export async function getCreatorProfile(slug: string): Promise<CreatorProfile | null> {
  await fresh();
  const c = await q.getCreatorBySlug(slug);
  if (!c || c.hidden) return null; // hidden (testing) creators have no public profile
  const products = await q.listPublishedProducts({ creatorId: c.id });
  return { ...toPublicCreator(c), products: products.map(toShopProduct) };
}

/** Where "See a story tag in action" goes when no example story tag exists yet. */
export const STORY_TAG_FALLBACK_HREF = "/how-it-works#story-tags";

/**
 * "See a story tag in action" on the shop: the dedicated demo story tag when `DEMO_STORY_TAG_TOKEN`
 * is set (a staged order the product owner placed as "Demo buyer"; read on the server only, never
 * a real buyer's tag), else the story-tags section of How it works (T128).
 */
export async function getDemoStoryTagHref(): Promise<string> {
  await fresh();
  const token = normalizeToken(process.env.DEMO_STORY_TAG_TOKEN ?? "");
  return token ? `/t/${encodeURIComponent(token)}` : STORY_TAG_FALLBACK_HREF;
}

/** WebVTT text for a creator's story video, or null. */
export async function getCreatorCaptions(creatorId: string): Promise<string | null> {
  await fresh();
  if (!isUuid(creatorId)) return null;
  return (await q.getCreatorById(creatorId))?.storyVideoVtt ?? null;
}

export async function getStoryTag(token: string): Promise<StoryTagView | null> {
  await fresh();
  const t = normalizeToken(token);
  if (!t) return null;
  const tag = await q.getStoryTag(t);
  if (!tag) return null;
  const [shop, more] = await Promise.all([
    q.getPublicProduct(tag.product.id),
    q.listPublishedProducts({ creatorId: tag.creator.id, limit: 7 }),
  ]);
  return {
    token: tag.token.token,
    tapCount: tag.token.tapCount,
    productTitle: tag.listing?.title ?? "",
    product: shop ? toShopProduct(shop) : null,
    creator: toPublicCreator(tag.creator),
    moreFromStudio: more.filter((p) => p.product.id !== tag.product.id).slice(0, 6).map(toShopProduct),
    thankYou: tag.thankYou && (tag.thankYou.text || tag.thankYou.imageUrl || tag.thankYou.videoUrl)
      ? { text: tag.thankYou.text, imageUrl: tag.thankYou.imageUrl, videoUrl: tag.thankYou.videoUrl, videoVtt: tag.thankYou.videoVtt }
      : null,
    messages: tag.messages.map((x) => ({ id: x.id, direction: x.direction, body: x.body, createdAt: x.createdAt })),
  };
}

/** WebVTT captions for the thank-you video of the order behind a story tag, or null. */
export async function getTagThankYouCaptions(token: string): Promise<string | null> {
  await fresh();
  const t = normalizeToken(token);
  if (!t) return null;
  const tag = await q.getStoryTag(t);
  return tag?.thankYou?.videoUrl ? tag.thankYou.videoVtt ?? null : null;
}

export async function getOrderConfirmation(orderId: string): Promise<OrderConfirmation | null> {
  await fresh();
  if (!isUuid(orderId)) return null;
  const r = await q.getOrderConfirmation(orderId);
  return r ? { orderId: r.orderId, token: r.token, productTitle: r.productTitle ?? "", creatorName: r.creatorName } : null;
}

export async function listAdminOrders(): Promise<AdminOrder[]> {
  await fresh();
  const rows = await q.listOrdersAdmin();
  const msgs = await q.listMessagesForOrders(rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id, status: r.status, buyerName: r.buyerName, buyerEmail: r.buyerEmail, shipNote: r.shipNote,
    size: r.size, quantity: r.quantity,
    amountCents: r.amountCents, creatorShareCents: r.creatorShareCents, createdAt: r.createdAt,
    product: {
      id: r.productId, title: r.productTitle ?? "", type: r.productType, mockupUrl: r.mockupUrl,
      printPngUrl: r.printPngUrl, printSvgUrl: r.printSvgUrl, artworkId: r.artworkId,
    },
    creator: { displayName: r.creatorName, slug: r.creatorSlug },
    token: r.token,
    tapCount: r.tapCount,
    messages: msgs.filter((x) => x.orderId === r.id)
      .map((x) => ({ id: x.id, direction: x.direction, body: x.body, createdAt: x.createdAt })),
  }));
}

/** Admin: every creator, hidden ones too. Login codes are never part of this list. */
export async function listAdminCreators(): Promise<AdminCreator[]> {
  await fresh();
  return q.listCreatorsAdmin();
}

export async function getArtworkTrace(artworkId: string): Promise<ArtworkTrace | null> {
  await fresh();
  if (!isUuid(artworkId)) return null;
  const t = await q.getArtworkTrace(artworkId);
  if (!t) return null;
  const a = t.artwork;
  const variantRows = a.source === "text2image"
    ? [...t.siblings, ...t.ancestors.slice(1), ...(t.ancestors.length ? [a] : [])]
    : [];
  const seen = new Set<string>();
  const variants = variantRows.filter((v) => !seen.has(v.id) && seen.add(v.id)).map((v) => traceImage(v, a.id));
  // Which SAM candidate was chosen is not stored; with one candidate it was picked automatically.
  const cands = a.candidates ?? [];
  const candidates = cands.map((c) => ({
    id: c.id, url: c.thumbUrl, altText: null, chosen: cands.length === 1 && Boolean(a.cleanedUrl),
  }));
  const chain = [...t.ancestors, a];
  const previewOf = (r: q.ArtworkRow) => (r.shapingTrace as { previewUrl?: string } | null)?.previewUrl ?? null;
  const changes: TraceChange[] = chain.flatMap((r, i) => (r.changeInstruction ? [{
    id: r.id, instruction: r.changeInstruction, transcript: r.transcript,
    beforeUrl: i > 0 ? chain[i - 1].cleanedUrl ?? previewOf(chain[i - 1]) : null,
    afterUrl: previewOf(r) ?? r.cleanedUrl, differences: r.differencesFromPrompt,
  }] : []));
  const photoRow = a.source === "text2image" ? a : chain.find((r) => !r.changeInstruction) ?? a;
  return {
    artwork: {
      id: a.id, source: a.source, transcript: a.transcript, shapedPrompt: a.shapedPrompt, originalUrl: a.originalUrl,
      cleanedUrl: a.cleanedUrl, maskUrl: a.maskUrl, cutPathSvg: a.cutPathSvg, altText: a.altText,
      spokenDescription: a.spokenDescription, differencesFromPrompt: a.differencesFromPrompt,
      parentArtworkId: a.parentArtworkId, changeInstruction: a.changeInstruction, createdAt: a.createdAt,
    },
    photo: { originalUrl: photoRow.originalUrl, maskUrl: photoRow.maskUrl },
    changes,
    variants,
    candidates,
    calls: t.calls,
  };
}

// ---------------------------------------------------------------- writes

/** Staged checkout: creates the order and its story tag; shares come from the creator's split. */
export async function createOrder(productId: string, input: OrderInput, opts: WriteOpts): Promise<{ orderId: string; token: string }> {
  if (!isUuid(productId)) throw new Error("Unknown product");
  return placeOrder(productId, input, opts.task);
}

/** tapCount++ and firstTappedAt on the story tag. */
export async function recordTap(token: string, opts: WriteOpts): Promise<void> {
  void opts; // tap counts are an update, not a new row
  await tap(token);
}

/** Buyer → creator note from the story-tag page (direction buyer_to_creator; notifies the creator). */
export async function createBuyerMessage(token: string, body: string, opts: WriteOpts): Promise<void> {
  await sendReply(token, body, opts.task);
}

/** Admin: moves an order to `status` (sets statusUpdatedAt). */
export async function updateOrderStatus(orderId: string, status: OrderStatus, opts: WriteOpts): Promise<void> {
  void opts; // status changes update an existing row
  if (!isUuid(orderId)) throw new Error("Unknown order");
  const row = await q.updateOrderStatus(orderId, status);
  if (!row) throw new Error("Unknown order");
}

/** Admin: the studio creates a creator and gets their login code (shown once). */
export async function createCreator(input: NewCreatorInput, opts: WriteOpts): Promise<IssuedCode> {
  const row = await q.createCreator({ ...input, createdByTask: opts.task });
  return { creatorId: row.id, displayName: row.displayName, code: row.loginCode! };
}

/** Admin: a new login code for the creator; the old code and its sign-in link stop working. */
export async function rotateCreatorCode(creatorId: string, opts: WriteOpts): Promise<IssuedCode> {
  void opts; // rotating updates an existing row
  if (!isUuid(creatorId)) throw new Error("Unknown creator");
  const creator = await q.getCreatorById(creatorId);
  const code = creator ? await q.rotateLoginCode(creatorId) : null;
  if (!creator || !code) throw new Error("Unknown creator");
  return { creatorId, displayName: creator.displayName, code };
}

/** Admin: hide a creator from the public shop (testing) or show them again. */
export async function setCreatorHidden(creatorId: string, hidden: boolean, opts: WriteOpts): Promise<void> {
  void opts; // updates an existing row
  if (!isUuid(creatorId) || !(await q.setCreatorHidden(creatorId, hidden))) throw new Error("Unknown creator");
}

// ---------------------------------------------------------------- helpers

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Postgres rejects malformed uuids with an error; a bad id in a URL is simply "not found". */
function isUuid(v: string): boolean {
  return UUID.test(v);
}

function normalizeToken(raw: string): string | null {
  const t = normalizeNfcToken(raw);
  return isNfcToken(t) ? t : null;
}
