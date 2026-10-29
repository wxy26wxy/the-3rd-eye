CREATE TYPE "public"."approved_via" AS ENUM('voice', 'tap');--> statement-breakpoint
CREATE TYPE "public"."artwork_source" AS ENUM('text2image', 'canvas', 'photo');--> statement-breakpoint
CREATE TYPE "public"."artwork_status" AS ENUM('draft', 'ready');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('creator_to_buyer', 'buyer_to_creator');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('placed', 'printing', 'shipped', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('staged', 'stripe');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('sticker', 'tote');--> statement-breakpoint
CREATE TABLE "ai_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" text,
	"stage" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"request_hash" text NOT NULL,
	"request_json" jsonb,
	"response_id" text,
	"response_json" jsonb,
	"latency_ms" integer,
	"cost_estimate_cents" integer,
	"artwork_id" uuid,
	"listing_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_task" text
);
--> statement-breakpoint
CREATE TABLE "artworks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"source" "artwork_source" NOT NULL,
	"transcript" text,
	"shaped_prompt" text,
	"shaping_trace" jsonb,
	"original_url" text,
	"cleaned_url" text,
	"mask_url" text,
	"cut_path_svg" text,
	"candidates" jsonb,
	"alt_text" text,
	"spoken_description" text,
	"differences_from_prompt" text,
	"gen_response_id" text,
	"parent_artwork_id" uuid,
	"artwork_video_url" text,
	"status" "artwork_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_task" text
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"studio_name" text,
	"avatar_url" text,
	"bio_short" text,
	"story_text" text,
	"story_video_url" text,
	"story_video_vtt" text,
	"story_video_transcript" text,
	"mention_disability" boolean DEFAULT false NOT NULL,
	"access_prefs" jsonb DEFAULT '{"voiceFirst":true,"simpleMode":true,"speakDescriptions":true,"highContrast":false,"largeText":false,"helperMode":false}'::jsonb NOT NULL,
	"split" jsonb DEFAULT '{"creator_bps":5000,"org_bps":3000,"production_bps":2000}'::jsonb NOT NULL,
	"login_code" text,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_task" text,
	CONSTRAINT "creators_slug_unique" UNIQUE("slug"),
	CONSTRAINT "creators_login_code_unique" UNIQUE("login_code")
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"price_suggestion_cents" integer,
	"print_check" jsonb,
	"moderation" jsonb,
	"agent_trace" jsonb,
	"approved_at" timestamp with time zone,
	"approved_via" "approved_via",
	"made_by_voice" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_task" text
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"direction" "message_direction" NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_task" text
);
--> statement-breakpoint
CREATE TABLE "nfc_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"first_tapped_at" timestamp with time zone,
	"tap_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_task" text,
	CONSTRAINT "nfc_tokens_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_email" text,
	"ship_note" text,
	"amount_cents" integer NOT NULL,
	"creator_share_cents" integer NOT NULL,
	"org_share_cents" integer NOT NULL,
	"status" "order_status" DEFAULT 'placed' NOT NULL,
	"payment_mode" "payment_mode" DEFAULT 'staged' NOT NULL,
	"payment_ref" text,
	"status_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_task" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artwork_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"type" "product_type" NOT NULL,
	"mockup_url" text,
	"print_png_url" text,
	"print_svg_url" text,
	"price_cents" integer DEFAULT 500 NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_task" text
);
--> statement-breakpoint
CREATE TABLE "thank_yous" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"text" text,
	"image_url" text,
	"video_url" text,
	"video_vtt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_task" text,
	CONSTRAINT "thank_yous_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nfc_tokens" ADD CONSTRAINT "nfc_tokens_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thank_yous" ADD CONSTRAINT "thank_yous_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;