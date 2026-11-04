/**
 * Maps database rows to the JSON shapes in docs/api.md. Field names here are the
 * contract shared with the web and iOS clients: do not rename.
 */
import type {
  ArtworkProductRow, ArtworkRow, ArtworkWithProducts, CreatorRow, ListingRow, MessageRow, OrderSummaryRow, ProductRow, ThankYouRow,
} from "@/lib/db/queries";

export function toCreator(c: CreatorRow) {
  return {
    id: c.id, slug: c.slug, displayName: c.displayName, studioName: c.studioName, avatarUrl: c.avatarUrl,
    bioShort: c.bioShort, storyText: c.storyText, storyVideoUrl: c.storyVideoUrl, storyVideoVtt: c.storyVideoVtt,
    mentionDisability: c.mentionDisability, accessPrefs: c.accessPrefs, split: c.split, isExample: c.isExample,
    storyDraft: c.storyDraft ?? null,
  };
}

export function toArtwork(a: ArtworkRow) {
  return {
    id: a.id, creatorId: a.creatorId, source: a.source, transcript: a.transcript, shapedPrompt: a.shapedPrompt,
    originalUrl: a.originalUrl, cleanedUrl: a.cleanedUrl, maskUrl: a.maskUrl, cutPathSvg: a.cutPathSvg,
    altText: a.altText, spokenDescription: a.spokenDescription, differencesFromPrompt: a.differencesFromPrompt,
    genResponseId: a.genResponseId, parentArtworkId: a.parentArtworkId, changeInstruction: a.changeInstruction ?? null, clientRequestId: a.clientRequestId ?? null, status: a.status, lastError: a.lastError, createdAt: a.createdAt,
  };
}

/**
 * `ArtworkProduct`: a product on a design tile (`GET /artworks`) and in the `products` of cleanup /
 * cutout responses (T143). `mockupUrl` is the AI product photo, `previewUrl` the bordered sticker (T121).
 */
export function toArtworkProduct({ id, type, status, priceCents, title, description, mockupUrl, previewUrl }: ArtworkProductRow) {
  return { id, type, status, priceCents, title, description, mockupUrl: mockupUrl ?? null, previewUrl: previewUrl ?? null };
}

/** `GET /artworks` item: the artwork plus its products for status badges and pictures. */
export function toArtworkListItem(a: ArtworkWithProducts) {
  return { ...toArtwork(a), products: a.products.map(toArtworkProduct) };
}

/** Public picture of a row: the cut-out when there is one, else the edited picture of a change result (T111). */
export function previewUrlOf(a: ArtworkRow): string | null {
  return a.cleanedUrl ?? (a.shapingTrace as { previewUrl?: string } | null)?.previewUrl ?? null;
}

export function toArtworkVariant(a: ArtworkRow) {
  return { ...toArtwork(a), previewUrl: previewUrlOf(a) };
}

export function toCandidates(a: ArtworkRow) {
  return (a.candidates ?? []).map(({ id, bbox, score, thumbUrl, cleanedUrl }) => ({ id, bbox, score, thumbUrl, ...(cleanedUrl ? { cleanedUrl } : {}) }));
}

export function toProduct(p: ProductRow) {
  return {
    id: p.id, artworkId: p.artworkId, creatorId: p.creatorId, type: p.type, mockupUrl: p.mockupUrl, previewUrl: p.previewUrl ?? null,
    printPngUrl: p.printPngUrl, printSvgUrl: p.printSvgUrl, priceCents: p.priceCents, status: p.status,
    clientRequestId: p.clientRequestId ?? null,
  };
}

type StoredPrintCheck = { print_ok?: boolean; check?: "resolution" | "contrast" | null; notes?: string; resolution?: { ok?: boolean } } | null;

/** Which print check is flagged on a stored check (T134): `check` when recorded, else derived from an older row. */
export function printIssueOf(pc: unknown): "resolution" | "contrast" | null {
  const c = pc as StoredPrintCheck;
  if (!c) return null;
  if (c.check !== undefined) return c.check ?? null;
  if (c.print_ok === true) return null;
  return c.resolution?.ok === false ? "resolution" : "contrast";
}

/** `ListingDraft` of a stored listing (T134 `GET /listings/{id}`): the pending re-run copy when there is one, else the row. */
export function toListingDraft(l: ListingRow) {
  const src = l.draftCopy ?? { title: l.title, description: l.description ?? "", tags: l.tags, priceSuggestionCents: l.priceSuggestionCents ?? 0, printCheck: l.printCheck };
  const pc = src.printCheck as StoredPrintCheck;
  return {
    title: src.title, description: src.description ?? "", tags: src.tags ?? [], price_cents: src.priceSuggestionCents ?? 0,
    print_ok: pc?.print_ok === true, print_check: printIssueOf(pc), notes: pc?.notes ?? "",
  };
}

export function toListing(l: ListingRow) {
  return {
    productId: l.productId, title: l.title, description: l.description, tags: l.tags,
    priceSuggestionCents: l.priceSuggestionCents, approvedAt: l.approvedAt, approvedVia: l.approvedVia, madeByVoice: l.madeByVoice,
  };
}

export function toOrderSummary(o: OrderSummaryRow) {
  return {
    id: o.id, productId: o.productId, productTitle: o.productTitle, mockupUrl: o.mockupUrl, buyerName: o.buyerName,
    amountCents: o.amountCents, creatorShareCents: o.creatorShareCents, size: o.size ?? null, quantity: o.quantity ?? 1, status: o.status, createdAt: o.createdAt,
    hasThankYou: o.hasThankYou, unreadMessages: o.unreadMessages,
  };
}

export function toOrder(o: OrderSummaryRow) {
  return { ...toOrderSummary(o), shipNote: o.shipNote, token: o.token };
}

export function toThankYou(t: ThankYouRow) {
  return { id: t.id, orderId: t.orderId, text: t.text, imageUrl: t.imageUrl, videoUrl: t.videoUrl, createdAt: t.createdAt };
}

export function toMessage(m: MessageRow) {
  return { id: m.id, orderId: m.orderId, direction: m.direction, body: m.body, createdAt: m.createdAt, readAt: m.readAt };
}
