ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "change_instruction" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "size" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "quantity" integer DEFAULT 1 NOT NULL;