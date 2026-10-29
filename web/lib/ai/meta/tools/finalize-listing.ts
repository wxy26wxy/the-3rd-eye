import type { ListingDraft } from "../../types";
import { PRICE_RANGES } from "@/lib/products/registry";
import { arr, bool, int, obj, str } from "../responses";
import type { ToolContext, ToolDef } from "./types";

export const LISTING_SCHEMA = obj({
  title: str("At most 60 characters"),
  description: str("2–4 sentences for shoppers"),
  tags: arr(str()),
  price_cents: int(),
  print_ok: bool(),
  notes: str("Anything the artist should know, or an empty string"),
});

/** Pure: cleans a draft (trims, caps tags, clamps price into the product's range). */
export function normalizeListing(raw: unknown, productType: ToolContext["productType"]): ListingDraft {
  const r = (raw ?? {}) as Partial<ListingDraft>;
  const { min, max } = PRICE_RANGES[productType];
  const price = Number.isFinite(Number(r.price_cents)) ? Math.round(Number(r.price_cents)) : min;
  return {
    title: String(r.title ?? "").trim().slice(0, 60) || "Untitled artwork",
    description: String(r.description ?? "").trim(),
    tags: (Array.isArray(r.tags) ? r.tags : []).map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 8),
    price_cents: Math.min(max, Math.max(min, price)),
    print_ok: Boolean(r.print_ok),
    notes: String(r.notes ?? "").trim(),
  };
}

export const finalizeListingTool: ToolDef = {
  name: "finalize_listing",
  description: "Submits the final listing. Call exactly once, after checking resolution, contrast, price and moderation.",
  parameters: LISTING_SCHEMA,
  handler: async (args, ctx) => ({ ok: true, listing: normalizeListing(args, ctx.productType) }),
};
