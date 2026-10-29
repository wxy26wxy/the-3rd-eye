/**
 * Every database read and write goes through this file (pages, routes and the
 * pipeline import from here; nothing else builds queries). Soft-delete aware:
 * rows with `deletedAt` set are never returned.
 */
import "server-only";
import { and, desc, eq, gt, isNull, like, or, sql, inArray } from "drizzle-orm";
import { generateLoginCode, slugify, uniqueSlug } from "@/lib/codes";
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

/** Creators the public shop lists (/artists, the featured artist). Hidden (testing) creators are left out unless asked for. */
export async function listCreators(opts: { includeHidden?: boolean } = {}): Promise<CreatorRow[]> {
  const conds = [isNull(creators.deletedAt)];
  if (!opts.includeHidden) conds.push(eq(creators.hidden, false));
  return db().select().from(creators).where(and(...conds)).orderBy(creators.isExample, desc(creators.createdAt));
}

export type AdminCreatorRow = Pick<CreatorRow, "id" | "slug" | "displayName" | "studioName" | "isExample" | "hidden" | "createdAt">
  & { publishedProducts: number };

/** Admin: every creator (hidden ones too) with their published product count. Never selects the login code. */
export async function listCreatorsAdmin(): Promise<AdminCreatorRow[]> {
  const rows = await db().select({
    id: creators.id, slug: creators.slug, displayName: creators.displayName, studioName: creators.studioName,
    isExample: creators.isExample, hidden: creators.hidden, createdAt: creators.createdAt,
    publishedProducts: sql<number>`(select count(*)::int from ${products} where ${products.creatorId} = ${creators.id}
      and ${products.status} = 'published' and ${products.deletedAt} is null)`,
  }).from(creators).where(isNull(creators.deletedAt)).orderBy(desc(creators.createdAt));
  return rows.map((r) => ({ ...r, publishedProducts: Number(r.publishedProducts ?? 0) }));
}

/** True for a Postgres unique violation (drizzle wraps driver errors in `cause`). */
function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err, i = 0; e && i < 4; e = (e as { cause?: unknown }).cause, i++) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
}

const CREATE_TRIES = 5;

/**
 * Studio-issued creator (admin, T070): a unique slug from the display name (-2, -3 … on
 * collision, soft-deleted rows included because the unique index covers them) and a fresh
 * login code, retried on a unique violation up to 5 times. Returns the row; the caller shows
 * `loginCode` once and must not log it.
 */
export async function createCreator(input: {
  displayName: string; studioName?: string | null; mentionDisability?: boolean; hidden?: boolean; createdByTask: string;
}): Promise<CreatorRow> {
  const base = slugify(input.displayName);
  let lastErr: unknown;
  for (let attempt = 0; attempt < CREATE_TRIES; attempt++) {
    const taken = await db().select({ slug: creators.slug }).from(creators)
      .where(or(eq(creators.slug, base), like(creators.slug, `${base}-%`)));
    try {
      const [row] = await db().insert(creators).values({
        slug: uniqueSlug(base, taken.map((t) => t.slug)),
        displayName: input.displayName,
        studioName: input.studioName || null,
        mentionDisability: input.mentionDisability ?? false,
        hidden: input.hidden ?? false,
        loginCode: generateLoginCode(),
        isExample: false,
        createdByTask: input.createdByTask,
      }).returning();
      return row;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      lastErr = err;
    }
  }
  throw new Error("Could not create a unique creator after 5 tries", { cause: lastErr });
}

/** Admin: replaces the creator's login code (the old code and any sign-in link stop working). Returns the new code. */
export async function rotateLoginCode(id: string): Promise<string | null> {
  for (let attempt = 0; attempt < CREATE_TRIES; attempt++) {
    const code = generateLoginCode();
    try {
      const [row] = await db().update(creators).set({ loginCode: code })
        .where(and(eq(creators.id, id), isNull(creators.deletedAt))).returning({ id: creators.id });
      return row ? code : null;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error("Could not rotate the login code after 5 tries");
}

export async function setCreatorHidden(id: string, hidden: boolean): Promise<boolean> {
  const [row] = await db().update(creators).set({ hidden })
    .where(and(eq(creators.id, id), isNull(creators.deletedAt))).returning({ id: creators.id });
  return Boolean(row);
}

export type CreatorPatch = Partial<Pick<CreatorRow,
  "displayName" | "studioName" | "avatarUrl" | "bioShort" | "storyText" | "storyVideoUrl" | "storyVideoVtt"
  | "storyVideoTranscript" | "storyDraft" | "mentionDisability" | "accessPrefs" | "split">>;

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

/** Records why a pipeline run did not finish; the row stays (or remains) a draft until a run succeeds. */
export async function markArtworksFailed(ids: string[], message: string): Promise<void> {
  if (!ids.length) return;
  await db().update(artworks).set({ lastError: message.slice(0, 500) }).where(inArray(artworks.id, ids));
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

/** Keeps new agent copy for a published product without touching the live listing (null clears it). */
export async function setListingDraftCopy(productId: string, draftCopy: ListingRow["draftCopy"]): Promise<void> {
  await db().update(listings).set({ draftCopy }).where(eq(listings.productId, productId));
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

/**
 * Published products for shop grids and "more from this studio". Hidden (testing) creators'
 * products are left out; `getPublicProduct` (a direct product link) still finds them.
 */
export async function listPublishedProducts(filter: { type?: ProductType; madeByVoice?: boolean; creatorId?: string; limit?: number } = {}): Promise<ShopProduct[]> {
  const conds = [eq(products.status, "published"), isNull(products.deletedAt), isNull(creators.deletedAt), isNull(artworks.deletedAt),
    eq(creators.hidden, false)];
  if (filter.type) conds.push(eq(products.type, filter.type));
  if (filter.creatorId) conds.push(eq(products.creatorId, filter.creatorId));
  if (filter.madeByVoice) conds.push(eq(artworks.source, "text2image"));
  return shopSelect().where(and(...conds)).orderBy(desc(products.createdAt)).limit(filter.limit ?? 100);
}

/** One published product by id. Hidden creators included on purpose: a direct product link keeps working. */
export async function getPublicProduct(id: string): Promise<ShopProduct | null> {
  const [row] = await shopSelect()
    .where(and(eq(products.id, id), eq(products.status, "published"), isNull(products.deletedAt),
      isNull(creators.deletedAt), isNull(artworks.deletedAt))).limit(1);
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

export type AdminOrderRow = OrderSummaryRow & {
  creatorName: string; creatorSlug: string; productType: ProductType; tapCount: number;
  printPngUrl: string | null; printSvgUrl: string | null; artworkId: string;
};

/** Admin: every order, newest first, with creator, product type, print files and story-tag taps. */
export async function listOrdersAdmin(limit = 200): Promise<AdminOrderRow[]> {
  const rows = await db().select({
    order: orders, productTitle: listings.title, mockupUrl: products.mockupUrl, token: nfcTokens.token,
    tapCount: nfcTokens.tapCount, creatorName: creators.displayName, creatorSlug: creators.slug, productType: products.type,
    printPngUrl: products.printPngUrl, printSvgUrl: products.printSvgUrl, artworkId: products.artworkId,
    hasThankYou: sql<boolean>`exists (select 1 from ${thankYous} where ${thankYous.orderId} = ${orders.id} and ${thankYous.deletedAt} is null)`,
    unreadMessages: sql<number>`0`,
  }).from(orders)
    .innerJoin(products, eq(products.id, orders.productId))
    .innerJoin(creators, eq(creators.id, orders.creatorId))
    .leftJoin(listings, eq(listings.productId, orders.productId))
    .leftJoin(nfcTokens, eq(nfcTokens.orderId, orders.id))
    .where(isNull(orders.deletedAt)).orderBy(desc(orders.createdAt)).limit(limit);
  return rows.map((r) => ({
    ...flattenSummary(r), creatorName: r.creatorName, creatorSlug: r.creatorSlug, productType: r.productType,
    tapCount: r.tapCount ?? 0, printPngUrl: r.printPngUrl, printSvgUrl: r.printSvgUrl, artworkId: r.artworkId,
  }));
}

/** What the buyer sees right after Buy: the story-tag token, product title and creator name. */
export async function getOrderConfirmation(orderId: string): Promise<{ orderId: string; token: string; productTitle: string | null; creatorName: string } | null> {
  const [row] = await db().select({ orderId: orders.id, token: nfcTokens.token, productTitle: listings.title, creatorName: creators.displayName })
    .from(orders)
    .innerJoin(nfcTokens, eq(nfcTokens.orderId, orders.id))
    .innerJoin(creators, eq(creators.id, orders.creatorId))
    .leftJoin(listings, eq(listings.productId, orders.productId))
    .where(and(eq(orders.id, orderId), isNull(orders.deletedAt), isNull(nfcTokens.deletedAt))).limit(1);
  return row ?? null;
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
    .where(and(eq(nfcTokens.token, token), isNull(nfcTokens.deletedAt), isNull(orders.deletedAt),
      isNull(products.deletedAt), isNull(creators.deletedAt))).limit(1);
  if (!row) return null;
  const [thankYou, msgs] = await Promise.all([getThankYou(row.order.id), listMessages(row.order.id)]);
  return { ...row, thankYou, messages: msgs };
}

export async function getOrderIdForToken(token: string): Promise<{ orderId: string; creatorId: string } | null> {
  const [row] = await db().select({ orderId: orders.id, creatorId: orders.creatorId }).from(nfcTokens)
    .innerJoin(orders, eq(orders.id, nfcTokens.orderId))
    .where(and(eq(nfcTokens.token, token), isNull(nfcTokens.deletedAt), isNull(orders.deletedAt))).limit(1);
  return row ?? null;
}

/** Media pathnames a story-tag holder may read: that order's thank-you video and image. */
export async function getTagMediaPaths(token: string): Promise<string[] | null> {
  const order = await getOrderIdForToken(token);
  if (!order) return null;
  const ty = await getThankYou(order.orderId);
  return [ty?.videoUrl, ty?.imageUrl].filter((p): p is string => Boolean(p) && !/^https?:/.test(p!));
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

/** Messages for many orders at once (admin table), oldest first. */
export async function listMessagesForOrders(orderIds: string[]): Promise<MessageRow[]> {
  if (orderIds.length === 0) return [];
  return db().select().from(messages)
    .where(and(inArray(messages.orderId, orderIds), isNull(messages.deletedAt))).orderBy(messages.createdAt);
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

// ---------- admin trace ----------

export type ArtworkTraceRows = {
  artwork: ArtworkRow;
  /** Refine chain, oldest first (parent of the parent … parent). */
  ancestors: ArtworkRow[];
  /** text2image rows from the same generation as the root of the chain (same creator, prompt and run), oldest first; includes the root. */
  siblings: ArtworkRow[];
  calls: AiCallRow[];
};

/** Sibling variants from one `POST /artworks` run are inserted within this window of each other. */
const GENERATION_WINDOW_MS = 10 * 60_000;
/** Shape and transcribe calls for a generation happen within this window before it. */
const LEAD_WINDOW_MS = 30 * 60_000;

/**
 * Everything the admin trace page shows for one artwork. Model calls are linked by `artworkId`;
 * the generate call by its response id (`genResponseId`); the shape and transcribe calls (traced
 * with `jobId = creatorId`, no artwork yet) are the creator's latest ones before the generation.
 */
export async function getArtworkTrace(artworkId: string): Promise<ArtworkTraceRows | null> {
  const artwork = await getArtwork(artworkId);
  if (!artwork) return null;
  const ancestors: ArtworkRow[] = [];
  let parentId = artwork.parentArtworkId;
  while (parentId && ancestors.length < 20) {
    const parent = await getArtwork(parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    parentId = parent.parentArtworkId;
  }
  const root = ancestors[0] ?? artwork;
  let siblings: ArtworkRow[] = [root];
  if (root.source === "text2image" && root.shapedPrompt) {
    const t = root.createdAt.getTime();
    siblings = await db().select().from(artworks).where(and(
      eq(artworks.creatorId, root.creatorId), eq(artworks.source, "text2image"), eq(artworks.shapedPrompt, root.shapedPrompt),
      isNull(artworks.parentArtworkId), isNull(artworks.deletedAt),
      sql`${artworks.createdAt} between ${new Date(t - GENERATION_WINDOW_MS)} and ${new Date(t + GENERATION_WINDOW_MS)}`,
    )).orderBy(artworks.createdAt);
  }
  const chain = [...ancestors, artwork];
  const ids = chain.map((a) => a.id);
  const responseIds = [...new Set([...chain, ...siblings].map((a) => a.genResponseId).filter((x): x is string => Boolean(x)))];
  const byArtwork = await listAiCallsForArtworks(ids);
  const byResponse = responseIds.length
    ? await db().select().from(aiCalls).where(and(inArray(aiCalls.responseId, responseIds), isNull(aiCalls.artworkId)))
    : [];
  const lead: AiCallRow[] = [];
  if (root.source === "text2image") {
    const start = Math.min(...siblings.map((a) => a.createdAt.getTime()), root.createdAt.getTime());
    const generateAt = byResponse.reduce((min, c) => Math.min(min, c.createdAt.getTime()), start);
    const before = await db().select().from(aiCalls).where(and(
      eq(aiCalls.jobId, root.creatorId), inArray(aiCalls.stage, ["shape", "transcribe"]),
      sql`${aiCalls.createdAt} between ${new Date(generateAt - LEAD_WINDOW_MS)} and ${new Date(generateAt)}`,
    )).orderBy(desc(aiCalls.createdAt));
    const shape = before.find((c) => c.stage === "shape");
    const transcribe = before.find((c) => c.stage === "transcribe" && (!shape || c.createdAt <= shape.createdAt));
    for (const c of [transcribe, shape]) if (c) lead.push(c);
  }
  const seen = new Set<string>();
  const calls = [...lead, ...byResponse, ...byArtwork].filter((c) => !seen.has(c.id) && seen.add(c.id))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return { artwork, ancestors, siblings, calls };
}
