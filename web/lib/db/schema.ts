/**
 * Database schema (Neon Postgres via Drizzle).
 * Conventions: uuid primary keys, soft deletes (`deletedAt`), `createdByTask`
 * records the T### task whose code path wrote the row (traceability).
 */
import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp, jsonb, primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const artworkSource = pgEnum("artwork_source", ["text2image", "canvas", "photo"]);
export const artworkStatus = pgEnum("artwork_status", ["draft", "ready"]);
export const productType = pgEnum("product_type", ["sticker", "tote"]);
export const productStatus = pgEnum("product_status", ["draft", "published", "archived"]);
export const orderStatus = pgEnum("order_status", ["placed", "printing", "shipped", "delivered"]);
export const paymentMode = pgEnum("payment_mode", ["staged", "stripe"]);
export const approvedVia = pgEnum("approved_via", ["voice", "tap"]);
export const messageDirection = pgEnum("message_direction", ["creator_to_buyer", "buyer_to_creator"]);

const trace = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdByTask: text("created_by_task"),
};

export type AccessPrefs = {
  voiceFirst: boolean; simpleMode: boolean; speakDescriptions: boolean;
  highContrast: boolean; largeText: boolean; helperMode: boolean;
};
export type Split = { creator_bps: number; org_bps: number; production_bps: number };
export type SamCandidate = { id: string; bbox: [number, number, number, number]; score: number; thumbUrl: string; maskUrl: string };

export const creators = pgTable("creators", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  studioName: text("studio_name"),
  avatarUrl: text("avatar_url"),
  bioShort: text("bio_short"),
  storyText: text("story_text"),
  storyVideoUrl: text("story_video_url"),          // private blob pathname
  storyVideoVtt: text("story_video_vtt"),          // WebVTT captions (Voice Transcribe)
  storyVideoTranscript: text("story_video_transcript"),
  mentionDisability: boolean("mention_disability").default(false).notNull(),
  accessPrefs: jsonb("access_prefs").$type<AccessPrefs>().default({
    voiceFirst: true, simpleMode: true, speakDescriptions: true, highContrast: false, largeText: false, helperMode: false,
  }).notNull(),
  split: jsonb("split").$type<Split>().default({ creator_bps: 5000, org_bps: 3000, production_bps: 2000 }).notNull(),
  loginCode: text("login_code").unique(),          // dev-mode sign in
  isExample: boolean("is_example").default(false).notNull(),
  ...trace,
});

export const artworks = pgTable("artworks", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id").references(() => creators.id).notNull(),
  source: artworkSource("source").notNull(),
  transcript: text("transcript"),                  // raw spoken idea
  shapedPrompt: text("shaped_prompt"),
  shapingTrace: jsonb("shaping_trace"),
  originalUrl: text("original_url"),               // private
  cleanedUrl: text("cleaned_url"),                 // public PNG with alpha
  maskUrl: text("mask_url"),                       // private
  cutPathSvg: text("cut_path_svg"),
  candidates: jsonb("candidates").$type<SamCandidate[]>(),
  altText: text("alt_text"),
  spokenDescription: text("spoken_description"),
  differencesFromPrompt: text("differences_from_prompt"),
  genResponseId: text("gen_response_id"),          // Muse Image response id for refine()
  parentArtworkId: uuid("parent_artwork_id"),
  artworkVideoUrl: text("artwork_video_url"),      // optional per-piece video (later)
  status: artworkStatus("status").default("draft").notNull(),
  ...trace,
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").references(() => artworks.id).notNull(),
  creatorId: uuid("creator_id").references(() => creators.id).notNull(),
  type: productType("type").notNull(),
  mockupUrl: text("mockup_url"),                   // public
  printPngUrl: text("print_png_url"),              // private
  printSvgUrl: text("print_svg_url"),              // private (die-cut line)
  priceCents: integer("price_cents").notNull().default(500),
  status: productStatus("status").default("draft").notNull(),
  ...trace,
});

export const listings = pgTable("listings", {
  productId: uuid("product_id").primaryKey().references(() => products.id),
  title: text("title").notNull(),
  description: text("description"),
  tags: text("tags").array().default(sql`'{}'::text[]`).notNull(),
  priceSuggestionCents: integer("price_suggestion_cents"),
  printCheck: jsonb("print_check"),
  moderation: jsonb("moderation"),
  agentTrace: jsonb("agent_trace"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedVia: approvedVia("approved_via"),
  madeByVoice: boolean("made_by_voice").default(false).notNull(),
  ...trace,
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  creatorId: uuid("creator_id").references(() => creators.id).notNull(),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email"),
  shipNote: text("ship_note"),
  amountCents: integer("amount_cents").notNull(),
  creatorShareCents: integer("creator_share_cents").notNull(),
  orgShareCents: integer("org_share_cents").notNull(),
  status: orderStatus("status").default("placed").notNull(),
  paymentMode: paymentMode("payment_mode").default("staged").notNull(),
  paymentRef: text("payment_ref"),
  statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true }).defaultNow().notNull(),
  ...trace,
});

export const nfcTokens = pgTable("nfc_tokens", {
  token: text("token").primaryKey(),               // 12-char base32
  orderId: uuid("order_id").references(() => orders.id).notNull().unique(),
  firstTappedAt: timestamp("first_tapped_at", { withTimezone: true }),
  tapCount: integer("tap_count").default(0).notNull(),
  ...trace,
});

export const thankYous = pgTable("thank_yous", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id).notNull().unique(),
  text: text("text"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),                     // private
  videoVtt: text("video_vtt"),
  ...trace,
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id).notNull(),
  direction: messageDirection("direction").notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  ...trace,
});

/** Append-only trace of every model call. */
export const aiCalls = pgTable("ai_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: text("job_id"),
  stage: text("stage").notNull(),                  // transcribe | shape | generate | refine | describe | segment | sticker | mockup | listing | story | captions
  provider: text("provider").notNull(),            // meta | ollama | meta-fallback | fixture
  model: text("model").notNull(),
  requestHash: text("request_hash").notNull(),
  requestJson: jsonb("request_json"),              // media bytes redacted
  responseId: text("response_id"),
  responseJson: jsonb("response_json"),
  latencyMs: integer("latency_ms"),
  costEstimateCents: integer("cost_estimate_cents"),
  artworkId: uuid("artwork_id"),
  listingId: uuid("listing_id"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdByTask: text("created_by_task"),
});

export const creatorsRelations = relations(creators, ({ many }) => ({ artworks: many(artworks), products: many(products) }));
export const artworksRelations = relations(artworks, ({ one, many }) => ({
  creator: one(creators, { fields: [artworks.creatorId], references: [creators.id] }),
  products: many(products),
}));
export const productsRelations = relations(products, ({ one }) => ({
  artwork: one(artworks, { fields: [products.artworkId], references: [artworks.id] }),
  creator: one(creators, { fields: [products.creatorId], references: [creators.id] }),
  listing: one(listings, { fields: [products.id], references: [listings.productId] }),
}));
export const ordersRelations = relations(orders, ({ one, many }) => ({
  product: one(products, { fields: [orders.productId], references: [products.id] }),
  creator: one(creators, { fields: [orders.creatorId], references: [creators.id] }),
  nfc: one(nfcTokens, { fields: [orders.id], references: [nfcTokens.orderId] }),
  thankYou: one(thankYous, { fields: [orders.id], references: [thankYous.orderId] }),
  messages: many(messages),
}));
