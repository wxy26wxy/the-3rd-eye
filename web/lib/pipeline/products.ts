/** Product creation (print files + mockup) and the listing agent / approval flow. */
import "server-only";
import sharp from "sharp";
import { ai } from "@/lib/ai/registry";
import type { AgentStep, ListingDraft, Moderation, Trace } from "@/lib/ai/types";
import { checkResolution, measureContrast, printCheckFrom, type ContrastCheck, type ResolutionCheck } from "@/lib/products/checks";
import { productSpec, type ProductKind } from "@/lib/products/registry";
import {
  getArtwork, getCreatorById, getListing, getProduct, insertProduct, setListingDraftCopy, setListingPrintCheck, updateProduct, upsertListing,
  type ArtworkRow, type ListingRow, type ProductRow,
} from "@/lib/db/queries";
import { creatorPath, storage } from "@/lib/storage";
import { ApiError } from "@/lib/http";
import { ensureDpi } from "@/lib/image/sticker";

/** Builds and stores a product's print PNG (+ die-cut SVG) and mockup from the artwork's cleaned PNG. */
async function buildProductFiles(artwork: ArtworkRow, type: ProductKind, task: string) {
  if (!artwork.cleanedUrl) throw new Error("Choose and clean up the artwork first");
  const spec = productSpec(type);
  const cleanedPng = await storage().read(artwork.cleanedUrl);
  const built = await spec.build({ cleanedPng }, { mockups: (await ai()).mockups, trace: { stage: "mockup", artworkId: artwork.id, task } });
  const cid = artwork.creatorId;
  // Every product type gets a print PNG at its spec's minimum size (upscaled at most ×2, alpha kept).
  const printPng = await ensureDpi(built.printPng ?? cleanedPng, spec.printSpec.minShortSidePx, spec.printSpec.dpi);
  const [png, svg, mockup] = await Promise.all([
    storage().putPrivate(creatorPath(cid, "print", "png"), printPng, "image/png"),
    built.printSvg ? storage().putPrivate(creatorPath(cid, "print", "svg"), built.printSvg, "image/svg+xml") : null,
    storage().putPublic(creatorPath(cid, "mockups", "png"), built.mockupPng, "image/png"),
  ]);
  return { mockupUrl: mockup.url, printPngUrl: png.pathname, printSvgUrl: svg?.pathname ?? null, spec, printPng, cleanedPng };
}

export async function createProduct(artwork: ArtworkRow, type: ProductKind, task = "T010"): Promise<ProductRow> {
  const files = await buildProductFiles(artwork, type, task);
  const mid = Math.round((files.spec.priceRange.min + files.spec.priceRange.max) / 2 / 50) * 50;
  return insertProduct({
    artworkId: artwork.id, creatorId: artwork.creatorId, type, mockupUrl: files.mockupUrl,
    printPngUrl: files.printPngUrl, printSvgUrl: files.printSvgUrl, priceCents: mid, status: "draft", createdByTask: task,
  });
}

export type RebuildResult = { product: ProductRow; printOk: boolean; unpublished: boolean };

/**
 * After the artwork was cut out again: rebuilds the product's print file(s) and mockup from the
 * new cleaned PNG so the shop image, print file and mockup agree, then re-runs the print check
 * (resolution of the new print file, contrast of the new art) into `listing.printCheck`. A
 * published product whose check now fails goes back to draft (approve re-checks before it can be
 * published again). Id, price and listing copy are unchanged.
 */
export async function rebuildProductFiles(productId: string, task = "T080"): Promise<RebuildResult> {
  const product = await getProduct(productId);
  if (!product) throw new Error("Unknown product");
  const artwork = await getArtwork(product.artworkId);
  if (!artwork?.cleanedUrl) throw new Error("Product has no artwork");
  const files = await buildProductFiles(artwork, product.type, task);
  const meta = await sharp(files.printPng).metadata();
  const check = printCheckFrom(
    checkResolution({ productType: product.type, width: meta.width ?? 0, height: meta.height ?? 0 }),
    await measureContrast(files.cleanedPng),
  );
  const unpublished = product.status === "published" && !check.print_ok;
  if (unpublished) console.warn(`[products] ${product.id} moved back to draft after a re-cut: ${check.notes}`);
  const updated = await updateProduct(product.id, {
    mockupUrl: files.mockupUrl, printPngUrl: files.printPngUrl, printSvgUrl: files.printSvgUrl, ...(unpublished ? { status: "draft" as const } : {}),
  });
  // Product first (new files + status), then the check that describes them.
  await setListingPrintCheck(product.id, check);
  return { product: updated, printOk: check.print_ok, unpublished };
}

/** Builds and stores the print file(s) for a product that has none (products made before T050). */
export async function ensurePrintFile(product: ProductRow, artwork: ArtworkRow, task = "T050"): Promise<ProductRow> {
  if (product.printPngUrl) return product;
  if (!artwork.cleanedUrl) throw new Error("Artwork has no cleaned image");
  void task; // an update of an existing row; createdByTask stays with the product's creator
  const spec = productSpec(product.type);
  const files = await spec.buildPrint(await storage().read(artwork.cleanedUrl));
  const printPng = await ensureDpi(files.printPng, spec.printSpec.minShortSidePx, spec.printSpec.dpi);
  const [png, svg] = await Promise.all([
    storage().putPrivate(creatorPath(product.creatorId, "print", "png"), printPng, "image/png"),
    files.printSvg && !product.printSvgUrl ? storage().putPrivate(creatorPath(product.creatorId, "print", "svg"), files.printSvg, "image/svg+xml") : null,
  ]);
  return updateProduct(product.id, { printPngUrl: png.pathname, ...(svg ? { printSvgUrl: svg.pathname } : {}) });
}

type Step = { tool?: string; args?: unknown; result?: unknown };
const isCheck = (r: unknown): r is { ok: boolean } => Boolean(r) && typeof (r as { ok?: unknown }).ok === "boolean";
/** The last result of `tool` in the agent trace when it is a well-formed check, else null. */
function toolResult<T extends { ok: boolean }>(trace: Step[], tool: string): T | null {
  const r = [...trace].reverse().find((s) => s.tool === tool)?.result;
  return isCheck(r) ? (r as T) : null;
}

/**
 * Runs the listing agent, then decides the publish gate on the server: `print_ok` comes from the
 * resolution and contrast tool results (computed here when the model skipped them, measured on
 * the product's print file) and moderation runs on the FINAL title and description. On a
 * published product the new copy is stored as a pending draft; the live listing changes only
 * through approve.
 */
export async function runListingAgent(product: ProductRow, artwork: ArtworkRow, task = "T050"): Promise<{ listing: ListingDraft; trace: AgentStep[]; row: ListingRow }> {
  if (product.status === "archived") throw new ApiError(409, "product_archived", "This product was removed with its design");
  const creator = await getCreatorById(product.creatorId);
  const imageUrl = artwork.cleanedUrl ?? product.mockupUrl;
  if (!imageUrl) throw new Error("Product has no image yet");
  const imagePng = await storage().read(imageUrl);
  const printPng = product.printPngUrl ? await storage().read(product.printPngUrl) : imagePng;
  const meta = await sharp(printPng).metadata();
  const width = meta.width ?? 0, height = meta.height ?? 0;
  const registry = await ai();
  const traceCtx = { stage: "listing", artworkId: artwork.id, listingId: product.id, task };
  const { listing: proposed, trace } = await registry.listingAgent.run({
    productId: product.id, productType: product.type, altText: artwork.altText ?? "Original artwork",
    creatorStory: creator?.storyText ?? undefined, imageUrl, width, height,
    creatorShareBps: creator?.split.creator_bps ?? 5000,
  }, { trace: traceCtx });

  const resolution = toolResult<ResolutionCheck>(trace, "check_resolution") ?? checkResolution({ productType: product.type, width, height });
  const contrast = toolResult<ContrastCheck>(trace, "check_contrast") ?? await measureContrast(imagePng);
  const printCheck = printCheckFrom(resolution, contrast);
  const moderation = await moderateFinal(trace, proposed, registry.listingAgent, { ...traceCtx, stage: "moderate" });
  const listing: ListingDraft = { ...proposed, print_ok: printCheck.print_ok, notes: [printCheck.notes, proposed.notes].filter(Boolean).join(" ").trim() };
  const fields = {
    title: listing.title, description: listing.description, tags: listing.tags, priceSuggestionCents: listing.price_cents,
    printCheck: { ...printCheck, notes: listing.notes }, moderation, agentTrace: trace,
  };

  const existing = product.status === "published" ? await getListing(product.id) : null;
  if (existing) {
    await setListingDraftCopy(product.id, { ...fields, createdAt: new Date().toISOString() });
    return { listing, trace, row: (await getListing(product.id))! };
  }
  const row = await upsertListing({
    productId: product.id, ...fields, draftCopy: null, approvedAt: null, approvedVia: null,
    madeByVoice: artwork.source === "text2image", createdByTask: task,
  });
  return { listing, trace, row };
}

/** Same tags, ignoring order, surrounding spaces and duplicates. */
function sameTags(a: unknown, b: string[]): boolean {
  if (!Array.isArray(a)) return b.length === 0;
  const norm = (xs: unknown[]) => [...new Set(xs.map((x) => String(x).trim()))].sort().join("\n");
  return norm(a) === norm(b);
}

/**
 * Reuses the agent's moderate_content result only when it checked exactly the final title,
 * description AND tags; otherwise moderates again.
 */
async function moderateFinal(
  trace: Step[], final: ListingDraft, agent: Awaited<ReturnType<typeof ai>>["listingAgent"], modTrace: Trace,
): Promise<Moderation | null> {
  const last = [...trace].reverse().find((s) => s.tool === "moderate_content");
  const args = (last?.args ?? {}) as { title?: string; description?: string; tags?: unknown };
  if (last && isCheck(last.result) && args.title?.trim() === final.title && (args.description ?? "").trim() === final.description
    && sameTags(args.tags, final.tags ?? [])) {
    return last.result as Moderation;
  }
  if (!agent.moderate) return null;
  return agent.moderate({ title: final.title, description: final.description, tags: final.tags }, { trace: modTrace });
}

/**
 * Publishes a product. Blocks with 409 when the print check failed (`print_check_failed`) or the
 * listing text fails moderation (`moderation_failed`). Edited text is moderated again, so edits
 * cannot bypass the check; a listing with no moderation result is moderated before publishing.
 */
export async function approveListing(
  product: ProductRow,
  input: { approvedVia: "voice" | "tap"; edits?: { title?: string; description?: string; priceCents?: number } },
  task = "T010",
): Promise<{ product: ProductRow; listing: ListingRow; storyVideoNeeded: boolean }> {
  if (product.status === "archived") throw new ApiError(409, "product_archived", "This product was removed with its design");
  const stored = await getListing(product.id);
  if (!stored) throw new ApiError(409, "listing_missing", "Run the listing agent first");
  // A pending re-run (published product) is what gets approved; otherwise the stored listing.
  const pending = stored.draftCopy;
  const existing = pending
    ? { ...stored, title: pending.title, description: pending.description, tags: pending.tags, priceSuggestionCents: pending.priceSuggestionCents,
      printCheck: pending.printCheck, moderation: pending.moderation, agentTrace: pending.agentTrace }
    : stored;
  const printCheck = existing.printCheck as { print_ok?: boolean; notes?: string } | null;
  if (printCheck?.print_ok !== true) {
    throw new ApiError(409, "print_check_failed", printCheck?.notes || "This artwork will not print well at this size. Try a larger or clearer picture.");
  }
  // With an edits object, a field not sent keeps the live text (clients send only what was typed). A plain
  // approve (no edits) publishes the pending re-run copy. Changed text is moderated again.
  const base = pending && input.edits && Object.values(input.edits).some((v) => v !== undefined) ? stored : existing;
  const title = input.edits?.title?.trim() || base.title;
  const description = input.edits?.description?.trim() ?? base.description ?? "";
  let moderation = existing.moderation as { ok?: boolean; reason?: string } | null;
  const textChanged = title !== existing.title || description !== (existing.description ?? "");
  if (textChanged || moderation?.ok === undefined) {
    const agent = (await ai()).listingAgent;
    if (!agent.moderate) throw new ApiError(503, "moderation_unavailable", "Listing text could not be checked; try again");
    moderation = await agent.moderate({ title, description, tags: existing.tags }, { trace: { stage: "moderate", listingId: product.id, task } });
  }
  if (moderation?.ok !== true) {
    if (pending) await setListingDraftCopy(product.id, { ...pending, moderation });
    else await upsertListing({ ...stored, productId: product.id, moderation });
    throw new ApiError(409, "moderation_failed", moderation?.reason || "This listing text cannot be published. Please change it.");
  }
  // A published product keeps its live price unless the creator sends one; the agent's suggestion only prices a draft.
  const price = input.edits?.priceCents
    ?? (product.status === "published" ? product.priceCents : existing.priceSuggestionCents ?? product.priceCents);
  const listing = await upsertListing({
    ...existing, productId: product.id, title, description, moderation, draftCopy: null,
    approvedAt: new Date(), approvedVia: input.approvedVia, createdByTask: stored.createdByTask ?? task,
  });
  const updated = await updateProduct(product.id, { status: "published", priceCents: Math.max(100, Math.round(price)) });
  const creator = await getCreatorById(product.creatorId);
  return { product: updated, listing, storyVideoNeeded: !creator?.storyVideoUrl };
}
