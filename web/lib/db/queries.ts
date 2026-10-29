/**
 * Every database read and write goes through this file (pages, routes and the
 * pipeline import from here; nothing else builds queries). Soft-delete aware:
 * rows with `deletedAt` set are never returned.
 */
import "server-only";
import { and, desc, eq, gt, isNull, sql, inArray } from "drizzle-orm";
import { getDb } from "./client";
import {
  aiCalls, artworks, creators, listings, messages, nfcTokens, orders, products, thankYous,
} from "./schema";

export type CreatorRow = typeof creators.$inferSelect;
export type ArtworkRow = typeof artworks.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type ListingRow = typeof listings.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type NfcTokenRow = typeof nfcTokens.$inferSelect;
export type ThankYouRow = typeof thankYous.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type AiCallRow = typeof aiCalls.$inferSelect;
export type OrderStatus = OrderRow["status"];
export type ProductType = ProductRow["type"];

const db = () => getDb();

// ---------- creators ----------

export async function getCreatorById(id: string): Promise<CreatorRow | null> {
  const [row] = await db().select().from(creators).where(and(eq(creators.id, id), isNull(creators.deletedAt))).limit(1);
  return row ?? null;
}

export async function getCreatorBySlug(slug: string): Promise<CreatorRow | null> {
  const [row] = await db().select().from(creators).where(and(eq(creators.slug, slug), isNull(creators.deletedAt))).limit(1);
  return row ?? null;
}

export async function getCreatorByLoginCode(code: string): Promise<CreatorRow | null> {
  const [row] = await db().select().from(creators)
    .where(and(eq(creators.loginCode, code.trim().toUpperCase()), isNull(creators.deletedAt))).limit(1);
  return row ?? null;
}

/** True when `pathname` is some creator's current story video (public by design). */
export async function isStoryVideoPath(pathname: string): Promise<boolean> {
  const [row] = await db().select({ id: creators.id }).from(creators)
    .where(and(eq(creators.storyVideoUrl, pathname), isNull(creators.deletedAt))).limit(1);
  return Boolean(row);
}

export async function listCreators(): Promise<CreatorRow[]> {
  return db().select().from(creators).where(isNull(creators.deletedAt)).orderBy(creators.isExample, desc(creators.createdAt));
}

export type CreatorPatch = Partial<Pick<CreatorRow,
  "displayName" | "studioName" | "avatarUrl" | "bioShort" | "storyText" | "storyVideoUrl" | "storyVideoVtt"
  | "storyVideoTranscript" | "mentionDisability" | "accessPrefs" | "split">>;

export async function updateCreator(id: string, patch: CreatorPatch): Promise<CreatorRow | null> {
  if (Object.keys(patch).length === 0) return getCreatorById(id);
  const [row] = await db().update(creators).set(patch).where(and(eq(creators.id, id), isNull(creators.deletedAt))).returning();
  return row ?? null;
}

/** Idempotent by slug (seed). */
export async function upsertCreatorBySlug(values: typeof creators.$inferInsert): Promise<CreatorRow> {
  const { slug, ...rest } = values;
  const [row] = await db().insert(creators).values(values)
    .onConflictDoUpdate({ target: creators.slug, set: { ...rest, slug } }).returning();
  return row;
}

// ---------- artworks ----------

export async function insertArtwork(values: typeof artworks.$inferInsert): Promise<ArtworkRow> {
  const [row] = await db().insert(artworks).values(values).returning();
  return row;
}

export async function getArtwork(id: string): Promise<ArtworkRow | null> {
  const [row] = await db().select().from(artworks).where(and(eq(artworks.id, id), isNull(artworks.deletedAt))).limit(1);
  return row ?? null;
}

export async function getArtworkForCreator(id: string, creatorId: string): Promise<ArtworkRow | null> {
  const row = await getArtwork(id);
  return row && row.creatorId === creatorId ? row : null;
}

export async function listArtworksByCreator(creatorId: string): Promise<ArtworkRow[]> {
  return db().select().from(artworks)
    .where(and(eq(artworks.creatorId, creatorId), isNull(artworks.deletedAt)))
    .orderBy(desc(artworks.createdAt));
}

export async function updateArtwork(id: string, patch: Partial<typeof artworks.$inferInsert>): Promise<ArtworkRow> {
  const [row] = await db().update(artworks).set(patch).where(eq(artworks.id, id)).returning();
  return row;
}

export async function softDeleteArtwork(id: string): Promise<void> {
  await db().update(artworks).set({ deletedAt: new Date() }).where(eq(artworks.id, id));
}

// ---------- products and listings ----------

export async function insertProduct(values: typeof products.$inferInsert): Promise<ProductRow> {
  const [row] = await db().insert(products).values(values).returning();
  return row;
}

export async function getProduct(id: string): Promise<ProductRow | null> {
  const [row] = await db().select().from(products).where(and(eq(products.id, id), isNull(products.deletedAt))).limit(1);
  return row ?? null;
}

export async function getProductForCreator(id: string, creatorId: string): Promise<ProductRow | null> {
  const row = await getProduct(id);
  return row && row.creatorId === creatorId ? row : null;
}

export async function updateProduct(id: string, patch: Partial<typeof products.$inferInsert>): Promise<ProductRow> {
  const [row] = await db().update(products).set(patch).where(eq(products.id, id)).returning();
  return row;
}

export async function getListing(productId: string): Promise<ListingRow | null> {
  const [row] = await db().select().from(listings).where(and(eq(listings.productId, productId), isNull(listings.deletedAt))).limit(1);
  return row ?? null;
}

export async function upsertListing(values: typeof listings.$inferInsert): Promise<ListingRow> {
  const { productId, ...rest } = values;
  const [row] = await db().insert(listings).values(values)
    .onConflictDoUpdate({ target: listings.productId, set: { ...rest, deletedAt: null } }).returning();
  void productId;
  return row;
}

/** A published product with what the shop needs to render it. */
export type ShopProduct = {
  product: ProductRow;
  listing: ListingRow | null;
  creator: CreatorRow;
  artwork: Pick<ArtworkRow, "id" | "source" | "altText" | "spokenDescription" | "cleanedUrl" | "cutPathSvg">;
};

function shopSelect() {
  return db().select({
    product: products,
    listing: listings,
    creator: creators,
    artwork: {
      id: artworks.id, source: artworks.source, altText: artworks.altText,
      spokenDescription: artworks.spokenDescription, cleanedUrl: artworks.cleanedUrl, cutPathSvg: artworks.cutPathSvg,
    },
  }).from(products)
    .innerJoin(creators, eq(creators.id, products.creatorId))
    .innerJoin(artworks, eq(artworks.id, products.artworkId))
    .leftJoin(listings, eq(listings.productId, products.id));
}

export async function listPublishedProducts(filter: { type?: ProductType; madeByVoice?: boolean; creatorId?: string; limit?: number } = {}): Promise<ShopProduct[]> {
  const conds = [eq(products.status, "published"), isNull(products.deletedAt), isNull(creators.deletedAt)];
  if (filter.type) conds.push(eq(products.type, filter.type));
  if (filter.creatorId) conds.push(eq(products.creatorId, filter.creatorId));
  if (filter.madeByVoice) conds.push(eq(artworks.source, "text2image"));
  return shopSelect().where(and(...conds)).orderBy(desc(products.createdAt)).limit(filter.limit ?? 100);
}

export async function getPublicProduct(id: string): Promise<ShopProduct | null> {
  const [row] = await shopSelect()
    .where(and(eq(products.id, id), eq(products.status, "published"), isNull(products.deletedAt))).limit(1);
  return row ?? null;
}

export async function listProductsByCreator(creatorId: string): Promise<ProductRow[]> {
  return db().select().from(products)
    .where(and(eq(products.creatorId, creatorId), isNull(products.deletedAt))).orderBy(desc(products.createdAt));
}

// ---------- orders and NFC tokens ----------

/** Inserts the order and its NFC token together (neon-http batch = one transaction). */
export async function insertOrderWithToken(
  order: typeof orders.$inferInsert & { id: string },
  token: string,
  createdByTask: string,
): Promise<{ order: OrderRow; token: string }> {
  const [[row]] = await db().batch([
    db().insert(orders).values(order).returning(),
    db().insert(nfcTokens).values({ token, orderId: order.id, createdByTask }),
  ]);
  return { order: row, token };
}

export type OrderSummaryRow = OrderRow & {
  productTitle: string | null; mockupUrl: string | null; hasThankYou: boolean; unreadMessages: number; token: string | null;
};

function orderSummarySelect() {
  return db().select({
    order: orders,
    productTitle: listings.title,
    mockupUrl: products.mockupUrl,
    token: nfcTokens.token,
    hasThankYou: sql<boolean>`exists (select 1 from ${thankYous} where ${thankYous.orderId} = ${orders.id} and ${thankYous.deletedAt} is null)`,
    unreadMessages: sql<number>`(select count(*)::int from ${messages} where ${messages.orderId} = ${orders.id}
      and ${messages.direction} = 'buyer_to_creator' and ${messages.readAt} is null and ${messages.deletedAt} is null)`,
  }).from(orders)
    .innerJoin(products, eq(products.id, orders.productId))
    .leftJoin(listings, eq(listings.productId, orders.productId))
    .leftJoin(nfcTokens, eq(nfcTokens.orderId, orders.id));
}

type SummarySelectRow = Awaited<ReturnType<ReturnType<typeof orderSummarySelect>["where"]>>[number];
const flattenSummary = (r: SummarySelectRow): OrderSummaryRow => ({
  ...r.order, productTitle: r.productTitle, mockupUrl: r.mockupUrl, token: r.token,
  hasThankYou: Boolean(r.hasThankYou), unreadMessages: Number(r.unreadMessages ?? 0),
});

export async function listOrdersForCreator(creatorId: string, since?: Date): Promise<OrderSummaryRow[]> {
  const conds = [eq(orders.creatorId, creatorId), isNull(orders.deletedAt)];
  if (since) conds.push(gt(orders.statusUpdatedAt, since));
  const rows = await orderSummarySelect().where(and(...conds)).orderBy(desc(orders.createdAt));
  return rows.map(flattenSummary);
}

export async function getOrderForCreator(orderId: string, creatorId: string): Promise<OrderSummaryRow | null> {
  const [row] = await orderSummarySelect()
    .where(and(eq(orders.id, orderId), eq(orders.creatorId, creatorId), isNull(orders.deletedAt))).limit(1);
  return row ? flattenSummary(row) : null;
}

/** Admin: every order, newest first, with creator name. */
export async function listOrdersAdmin(limit = 200): Promise<(OrderSummaryRow & { creatorName: string; printPngUrl: string | null; printSvgUrl: string | null; artworkId: string })[]> {
  const rows = await db().select({
    order: orders, productTitle: listings.title, mockupUrl: products.mockupUrl, token: nfcTokens.token,
    creatorName: creators.displayName, printPngUrl: products.printPngUrl, printSvgUrl: products.printSvgUrl, artworkId: products.artworkId,
    hasThankYou: sql<boolean>`exists (select 1 from ${thankYous} where ${thankYous.orderId} = ${orders.id} and ${thankYous.deletedAt} is null)`,
    unreadMessages: sql<number>`0`,
  }).from(orders)
    .innerJoin(products, eq(products.id, orders.productId))
    .innerJoin(creators, eq(creators.id, orders.creatorId))
    .leftJoin(listings, eq(listings.productId, orders.productId))
    .leftJoin(nfcTokens, eq(nfcTokens.orderId, orders.id))
    .where(isNull(orders.deletedAt)).orderBy(desc(orders.createdAt)).limit(limit);
  return rows.map((r) => ({
    ...flattenSummary(r), creatorName: r.creatorName, printPngUrl: r.printPngUrl, printSvgUrl: r.printSvgUrl, artworkId: r.artworkId,
  }));
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<OrderRow | null> {
  const [row] = await db().update(orders).set({ status, statusUpdatedAt: new Date() })
    .where(and(eq(orders.id, orderId), isNull(orders.deletedAt))).returning();
  return row ?? null;
}

/** Bumps statusUpdatedAt so `GET /orders?since=` pollers see thank-you / message changes. */
export async function touchOrder(orderId: string): Promise<void> {
  await db().update(orders).set({ statusUpdatedAt: new Date() }).where(eq(orders.id, orderId));
}

export type StoryTagView = {
  token: NfcTokenRow; order: OrderRow; product: ProductRow; listing: ListingRow | null; creator: CreatorRow;
  thankYou: ThankYouRow | null; messages: MessageRow[];
};

/** Everything the public story-tag page `/t/[token]` shows. */
export async function getStoryTag(token: string): Promise<StoryTagView | null> {
  const [row] = await db().select({ token: nfcTokens, order: orders, product: products, listing: listings, creator: creators })
    .from(nfcTokens)
    .innerJoin(orders, eq(orders.id, nfcTokens.orderId))
    .innerJoin(products, eq(products.id, orders.productId))
    .innerJoin(creators, eq(creators.id, orders.creatorId))
    .leftJoin(listings, eq(listings.productId, orders.productId))
    .where(and(eq(nfcTokens.token, token), isNull(nfcTokens.deletedAt), isNull(orders.deletedAt))).limit(1);
  if (!row) return null;
  const [thankYou, msgs] = await Promise.all([getThankYou(row.order.id), listMessages(row.order.id)]);
  return { ...row, thankYou, messages: msgs };
}

export async function getOrderIdForToken(token: string): Promise<{ orderId: string; creatorId: string } | null> {
  const [row] = await db().select({ orderId: orders.id, creatorId: orders.creatorId }).from(nfcTokens)
    .innerJoin(orders, eq(orders.id, nfcTokens.orderId))
    .where(and(eq(nfcTokens.token, token), isNull(nfcTokens.deletedAt))).limit(1);
  return row ?? null;
}

/** Increments tapCount and records the first tap. Returns the new count, or null for unknown tokens. */
export async function tapNfcToken(token: string): Promise<number | null> {
  const [row] = await db().update(nfcTokens).set({
    tapCount: sql`${nfcTokens.tapCount} + 1`,
    firstTappedAt: sql`coalesce(${nfcTokens.firstTappedAt}, now())`,
  }).where(and(eq(nfcTokens.token, token), isNull(nfcTokens.deletedAt))).returning({ tapCount: nfcTokens.tapCount });
  return row?.tapCount ?? null;
}

// ---------- thank-yous and messages ----------

export async function getThankYou(orderId: string): Promise<ThankYouRow | null> {
  const [row] = await db().select().from(thankYous).where(and(eq(thankYous.orderId, orderId), isNull(thankYous.deletedAt))).limit(1);
  return row ?? null;
}

export async function upsertThankYou(values: typeof thankYous.$inferInsert): Promise<ThankYouRow> {
  const { orderId, ...rest } = values;
  void orderId;
  const [row] = await db().insert(thankYous).values(values)
    .onConflictDoUpdate({ target: thankYous.orderId, set: { ...rest, deletedAt: null } }).returning();
  return row;
}

export async function listMessages(orderId: string): Promise<MessageRow[]> {
  return db().select().from(messages)
    .where(and(eq(messages.orderId, orderId), isNull(messages.deletedAt))).orderBy(messages.createdAt);
}

export async function insertMessage(values: typeof messages.$inferInsert): Promise<MessageRow> {
  const [row] = await db().insert(messages).values(values).returning();
  return row;
}

export async function markBuyerMessagesRead(orderId: string): Promise<void> {
  await db().update(messages).set({ readAt: new Date() }).where(and(
    eq(messages.orderId, orderId), eq(messages.direction, "buyer_to_creator"), isNull(messages.readAt),
  ));
}

export async function unreadCountForCreator(creatorId: string): Promise<number> {
  const [row] = await db().select({ n: sql<number>`count(*)::int` }).from(messages)
    .innerJoin(orders, eq(orders.id, messages.orderId))
    .where(and(eq(orders.creatorId, creatorId), eq(messages.direction, "buyer_to_creator"),
      isNull(messages.readAt), isNull(messages.deletedAt)));
  return Number(row?.n ?? 0);
}

// ---------- ai_calls ----------

export async function insertAiCall(values: typeof aiCalls.$inferInsert): Promise<void> {
  await db().insert(aiCalls).values(values);
}

export async function listAiCallsForArtwork(artworkId: string): Promise<AiCallRow[]> {
  return db().select().from(aiCalls).where(eq(aiCalls.artworkId, artworkId)).orderBy(aiCalls.createdAt);
}

export async function listAiCallsForArtworks(artworkIds: string[]): Promise<AiCallRow[]> {
  if (artworkIds.length === 0) return [];
  return db().select().from(aiCalls).where(inArray(aiCalls.artworkId, artworkIds)).orderBy(aiCalls.createdAt);
}
