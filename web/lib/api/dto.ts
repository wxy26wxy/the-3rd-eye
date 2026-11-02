/**
 * Maps database rows to the JSON shapes in docs/api.md. Field names here are the
 * contract shared with the web and iOS clients: do not rename.
 */
import type {
  ArtworkRow, ArtworkWithProducts, CreatorRow, ListingRow, MessageRow, OrderSummaryRow, ProductRow, ThankYouRow,
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
    genResponseId: a.genResponseId, parentArtworkId: a.parentArtworkId, changeInstruction: a.changeInstruction ?? null, status: a.status, lastError: a.lastError, createdAt: a.createdAt,
  };
}

/** `GET /artworks` item: the artwork plus its products for status badges (`previewUrl`: bordered sticker preview, T121). */
export function toArtworkListItem(a: ArtworkWithProducts) {
  return { ...toArtwork(a), products: a.products.map(({ id, type, status, priceCents, title, description, mockupUrl, previewUrl }) => ({ id, type, status, priceCents, title, description, mockupUrl, previewUrl })) };
}

/** Public picture of a row: the cut-out when there is one, else the edited picture of a change result (T111). */
export function previewUrlOf(a: ArtworkRow): string | null {
  return a.cleanedUrl ?? (a.shapingTrace as { previewUrl?: string } | null)?.previewUrl ?? null;
}

export function toArtworkVariant(a: ArtworkRow) {
  return { ...toArtwork(a), previewUrl: previewUrlOf(a) };
}

export function toCandidates(a: ArtworkRow) {
  return (a.candidates ?? []).map(({ id, bbox, score, thumbUrl }) => ({ id, bbox, score, thumbUrl }));
}

export function toProduct(p: ProductRow) {
  return {
    id: p.id, artworkId: p.artworkId, creatorId: p.creatorId, type: p.type, mockupUrl: p.mockupUrl, previewUrl: p.previewUrl ?? null,
    printPngUrl: p.printPngUrl, printSvgUrl: p.printSvgUrl, priceCents: p.priceCents, status: p.status,
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
