/**
 * Web data contract (T020).
 *
 * Pages, server actions and route handlers in the web workstream import data ONLY from
 * this module. It declares the shapes and functions the web needs from `lib/db/queries.ts`
 * (owned by the backend, T010). Until those functions land, the bodies below are thin
 * stubs: they return empty results, or example fixtures when `WEB_FIXTURES=1` is set
 * for local visual checks.
 *
 * Binding later: replace each stub body with a re-export, e.g.
 *   export { listShopProducts } from "./queries";
 * The signatures are the contract; keep them stable.
 */
import "server-only";
import { connection } from "next/server";
import type { InferSelectModel } from "drizzle-orm";
import type { aiCalls, artworks, creators } from "./schema";

type CreatorRow = InferSelectModel<typeof creators>;
type ArtworkRow = InferSelectModel<typeof artworks>;
export type AiCallRow = InferSelectModel<typeof aiCalls>;

export type ProductType = "sticker" | "tote";
export type OrderStatus = "placed" | "printing" | "shipped" | "delivered";
export const ORDER_STATUSES: OrderStatus[] = ["placed", "printing", "shipped", "delivered"];
export type ShopFilter = "all" | "sticker" | "tote" | "voice";

export type PublicCreator = Pick<
  CreatorRow,
  | "id" | "slug" | "displayName" | "studioName" | "avatarUrl" | "bioShort" | "storyText"
  | "storyVideoUrl" | "storyVideoVtt" | "mentionDisability" | "split" | "isExample"
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
export type StoryTagView = {
  token: string;
  tapCount: number;
  productTitle: string;
  product: ShopProduct | null;
  creator: PublicCreator;
  moreFromStudio: ShopProduct[];
};
export type OrderInput = { buyerName: string; buyerEmail?: string; shipNote?: string };
export type OrderConfirmation = { orderId: string; token: string; productTitle: string; creatorName: string };
export type AdminOrder = {
  id: string;
  status: OrderStatus;
  buyerName: string;
  buyerEmail: string | null;
  shipNote: string | null;
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
};
/** One image in the trace chain (a generated variant or a SAM candidate). */
export type TraceImage = { id: string; url: string | null; altText: string | null; chosen: boolean };
export type ArtworkTrace = {
  artwork: Pick<
    ArtworkRow,
    | "id" | "source" | "transcript" | "shapedPrompt" | "originalUrl" | "cleanedUrl" | "maskUrl" | "cutPathSvg"
    | "altText" | "spokenDescription" | "differencesFromPrompt" | "parentArtworkId" | "createdAt"
  >;
  /** text2image: every variant from the same generation plus refine ancestors; `chosen` marks this artwork. */
  variants: TraceImage[];
  /** photo/canvas: SAM candidates (artworks.candidates); `chosen` marks the selected one when known. */
  candidates: TraceImage[];
  calls: AiCallRow[];
};
type WriteOpts = { task: string };

const fixturesOn = () => process.env.WEB_FIXTURES === "1";
/** Shop data must be fresh per request (new listings appear immediately). Keep when binding. */
const fresh = () => connection();

// ---------------------------------------------------------------- reads

export async function listShopProducts(filter: ShopFilter = "all"): Promise<ShopProduct[]> {
  await fresh();
  // TODO(T010): bind to queries.listShopProducts
  if (!fixturesOn()) return [];
  const { FIXTURE_PRODUCTS } = await import("./queries.fixtures");
  return FIXTURE_PRODUCTS.filter((p) =>
    filter === "all" ? true : filter === "voice" ? p.madeByVoice : p.type === filter,
  );
}

export async function getProductDetail(id: string): Promise<ProductDetail | null> {
  await fresh();
  // TODO(T010): bind to queries.getProductDetail
  if (!fixturesOn()) return null;
  const f = await import("./queries.fixtures");
  return f.fixtureProductDetail(id);
}

export async function listPublicCreators(): Promise<CreatorSummary[]> {
  await fresh();
  // TODO(T010): bind to queries.listPublicCreators
  if (!fixturesOn()) return [];
  const { FIXTURE_CREATORS } = await import("./queries.fixtures");
  return FIXTURE_CREATORS;
}

/** The creator featured in the shop's MEET THE ARTIST block (most recent with a story video). */
export async function getFeaturedCreator(): Promise<PublicCreator | null> {
  await fresh();
  // TODO(T010): bind to queries.getFeaturedCreator
  if (!fixturesOn()) return null;
  const { FIXTURE_CREATORS } = await import("./queries.fixtures");
  return FIXTURE_CREATORS[0] ?? null;
}

export async function getCreatorProfile(slug: string): Promise<CreatorProfile | null> {
  await fresh();
  // TODO(T010): bind to queries.getCreatorProfile
  if (!fixturesOn()) return null;
  const f = await import("./queries.fixtures");
  return f.fixtureCreatorProfile(slug);
}

/** WebVTT text for a creator's story video, or null. */
export async function getCreatorCaptions(creatorId: string): Promise<string | null> {
  await fresh();
  // TODO(T010): bind to queries.getCreatorCaptions
  if (!fixturesOn()) return null;
  const { FIXTURE_CREATORS } = await import("./queries.fixtures");
  return FIXTURE_CREATORS.find((c) => c.id === creatorId)?.storyVideoVtt ?? null;
}

export async function getStoryTag(token: string): Promise<StoryTagView | null> {
  await fresh();
  // TODO(T010): bind to queries.getStoryTag
  if (!fixturesOn()) return null;
  const f = await import("./queries.fixtures");
  return f.fixtureStoryTag(token);
}

export async function getOrderConfirmation(orderId: string): Promise<OrderConfirmation | null> {
  await fresh();
  // TODO(T010): bind to queries.getOrderConfirmation
  if (!fixturesOn()) return null;
  return { orderId, token: "EXAMPLETAG01", productTitle: "Sunny Frog", creatorName: "Mira" };
}

export async function listAdminOrders(): Promise<AdminOrder[]> {
  await fresh();
  // TODO(T010): bind to queries.listAdminOrders
  if (!fixturesOn()) return [];
  const { FIXTURE_ORDERS } = await import("./queries.fixtures");
  return FIXTURE_ORDERS;
}

export async function getArtworkTrace(artworkId: string): Promise<ArtworkTrace | null> {
  await fresh();
  // TODO(T010): bind to queries.getArtworkTrace
  if (!fixturesOn()) return null;
  const f = await import("./queries.fixtures");
  return f.fixtureTrace(artworkId);
}

// ---------------------------------------------------------------- writes

export async function createOrder(productId: string, input: OrderInput, opts: WriteOpts): Promise<{ orderId: string; token: string }> {
  // TODO(T010): bind to queries.createOrder (staged payment; creates nfc token; notifies creator)
  void productId; void input; void opts;
  if (fixturesOn()) return { orderId: "00000000-0000-4000-8000-000000000001", token: "EXAMPLETAG01" };
  throw new Error("Orders are not available yet (queries.createOrder pending T010).");
}

export async function recordTap(token: string, opts: WriteOpts): Promise<void> {
  // TODO(T010): bind to queries.recordTap (tapCount++, firstTappedAt)
  void token; void opts;
}

export async function createBuyerMessage(token: string, body: string, opts: WriteOpts): Promise<void> {
  // TODO(T010): bind to queries.createBuyerMessage (direction buyer_to_creator)
  void token; void body; void opts;
  if (!fixturesOn()) throw new Error("Messages are not available yet (queries.createBuyerMessage pending T010).");
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, opts: WriteOpts): Promise<void> {
  // TODO(T010): bind to queries.updateOrderStatus (sets statusUpdatedAt)
  void orderId; void status; void opts;
  if (!fixturesOn()) throw new Error("Order updates are not available yet (queries.updateOrderStatus pending T010).");
}
