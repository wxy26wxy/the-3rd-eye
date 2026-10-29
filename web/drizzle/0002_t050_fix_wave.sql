ALTER TABLE "creators" ADD COLUMN "story_draft" jsonb;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "draft_copy" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "production_share_cents" integer;--> statement-breakpoint
UPDATE "orders" SET "production_share_cents" = "amount_cents" - "creator_share_cents" - "org_share_cents" WHERE "production_share_cents" IS NULL;
