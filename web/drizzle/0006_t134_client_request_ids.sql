ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "client_request_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "client_request_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "artworks_creator_client_request_uq" ON "artworks" USING btree ("creator_id","client_request_id") WHERE "artworks"."client_request_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_creator_client_request_uq" ON "products" USING btree ("creator_id","client_request_id") WHERE "products"."client_request_id" IS NOT NULL;