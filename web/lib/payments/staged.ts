/**
 * Staged payments (PAYMENTS_MODE=staged): Buy creates the order directly, no money moves.
 * Shares come from the creator's split (basis points); production gets the remainder.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import type { Split } from "@/lib/db/schema";
import { getCreatorById, getPublicProduct, insertOrderWithToken } from "@/lib/db/queries";
import { newNfcToken } from "@/lib/ids";
import { ApiError } from "@/lib/http";
import { notifyNewOrder } from "@/lib/notify/polling";
import type { PaymentProvider, PlaceOrderInput, PlaceOrderResult } from "./types";
import { moderateNote } from "@/lib/pipeline/notes";

/** The order does not need the note, so a moderation outage asks the buyer to drop it. */
export const SHIP_NOTE_UNAVAILABLE = "We could not check your note just now. Remove the note and try again, or try again in a minute.";

export function computeShares(amountCents: number, split: Split) {
  const creatorShareCents = Math.floor((amountCents * split.creator_bps) / 10_000);
  const orgShareCents = Math.floor((amountCents * split.org_bps) / 10_000);
  return { creatorShareCents, orgShareCents, productionShareCents: amountCents - creatorShareCents - orgShareCents };
}

export async function placeOrder(productId: string, input: PlaceOrderInput, task = "T010"): Promise<PlaceOrderResult> {
  const shop = await getPublicProduct(productId);
  if (!shop) throw new ApiError(404, "not_found", "This product is not for sale");
  const creator = await getCreatorById(shop.product.creatorId);
  if (!creator) throw new ApiError(404, "not_found", "Creator not found");
  const shipNote = input.shipNote?.trim() || null;
  if (shipNote) {
    await moderateNote(shipNote, { stage: "moderate", task, jobId: creator.id }, SHIP_NOTE_UNAVAILABLE);
  }
  const amount = shop.product.priceCents;
  const { creatorShareCents, orgShareCents, productionShareCents } = computeShares(amount, creator.split);
  const orderId = randomUUID();
  const { token } = await insertOrderWithToken({
    id: orderId, productId, creatorId: creator.id, buyerName: input.buyerName.trim(),
    buyerEmail: input.buyerEmail?.trim() || null, shipNote,
    amountCents: amount, creatorShareCents, orgShareCents, productionShareCents, paymentMode: "staged", createdByTask: task,
  }, newNfcToken(), task);
  await notifyNewOrder(creator.id, orderId);
  return { orderId, token };
}

export const stagedPayments: PaymentProvider = { mode: "staged", placeOrder: (id, input) => placeOrder(id, input) };
