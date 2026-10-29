/** Product creation (print files + mockup) and the listing agent / approval flow. */
import "server-only";
import sharp from "sharp";
import { ai } from "@/lib/ai/registry";
import type { AgentStep, ListingDraft } from "@/lib/ai/types";
import { productSpec, type ProductKind } from "@/lib/products/registry";
import {
  getCreatorById, getListing, insertProduct, updateProduct, upsertListing,
  type ArtworkRow, type ListingRow, type ProductRow,
} from "@/lib/db/queries";
import { creatorPath, storage } from "@/lib/storage";

export async function createProduct(artwork: ArtworkRow, type: ProductKind, task = "T010"): Promise<ProductRow> {
  if (!artwork.cleanedUrl) throw new Error("Choose and clean up the artwork first");
  const spec = productSpec(type);
  const cleanedPng = await storage().read(artwork.cleanedUrl);
  const built = await spec.build({ cleanedPng }, { image: (await ai()).image, trace: { stage: "mockup", artworkId: artwork.id, task } });
  const cid = artwork.creatorId;
  const [png, svg, mockup] = await Promise.all([
    built.printPng ? storage().putPrivate(creatorPath(cid, "print", "png"), built.printPng, "image/png") : null,
    built.printSvg ? storage().putPrivate(creatorPath(cid, "print", "svg"), built.printSvg, "image/svg+xml") : null,
    storage().putPublic(creatorPath(cid, "mockups", "png"), built.mockupPng, "image/png"),
  ]);
  const mid = Math.round((spec.priceRange.min + spec.priceRange.max) / 2 / 50) * 50;
  return insertProduct({
    artworkId: artwork.id, creatorId: cid, type, mockupUrl: mockup.url,
    printPngUrl: png?.pathname ?? null, printSvgUrl: svg?.pathname ?? null, priceCents: mid, status: "draft", createdByTask: task,
  });
}

export async function runListingAgent(product: ProductRow, artwork: ArtworkRow, task = "T010"): Promise<{ listing: ListingDraft; trace: AgentStep[]; row: ListingRow }> {
  const creator = await getCreatorById(product.creatorId);
  const imageUrl = artwork.cleanedUrl ?? product.mockupUrl;
  if (!imageUrl) throw new Error("Product has no image yet");
  const meta = await sharp(await storage().read(imageUrl)).metadata();
  const { listing, trace } = await (await ai()).listingAgent.run({
    productId: product.id, productType: product.type, altText: artwork.altText ?? "Original artwork",
    creatorStory: creator?.storyText ?? undefined, imageUrl, width: meta.width ?? 0, height: meta.height ?? 0,
    creatorShareBps: creator?.split.creator_bps ?? 5000,
  }, { trace: { stage: "listing", artworkId: artwork.id, listingId: product.id, task } });
  const findResult = (tool: string) => trace.find((s) => s.tool === tool)?.result ?? null;
  const row = await upsertListing({
    productId: product.id, title: listing.title, description: listing.description, tags: listing.tags,
    priceSuggestionCents: listing.price_cents,
    printCheck: { print_ok: listing.print_ok, resolution: findResult("check_resolution"), contrast: findResult("check_contrast"), notes: listing.notes },
    moderation: findResult("moderate_content"), agentTrace: trace, madeByVoice: artwork.source === "text2image", createdByTask: task,
  });
  return { listing, trace, row };
}

export async function approveListing(
  product: ProductRow,
  input: { approvedVia: "voice" | "tap"; edits?: { title?: string; description?: string; priceCents?: number } },
  task = "T010",
): Promise<{ product: ProductRow; listing: ListingRow; storyVideoNeeded: boolean }> {
  const existing = await getListing(product.id);
  if (!existing) throw new Error("Run the listing agent first");
  const price = input.edits?.priceCents ?? existing.priceSuggestionCents ?? product.priceCents;
  const listing = await upsertListing({
    ...existing, productId: product.id,
    title: input.edits?.title?.trim() || existing.title,
    description: input.edits?.description?.trim() ?? existing.description,
    approvedAt: new Date(), approvedVia: input.approvedVia, createdByTask: existing.createdByTask ?? task,
  });
  const updated = await updateProduct(product.id, { status: "published", priceCents: Math.max(100, Math.round(price)) });
  const creator = await getCreatorById(product.creatorId);
  return { product: updated, listing, storyVideoNeeded: !creator?.storyVideoUrl };
}
