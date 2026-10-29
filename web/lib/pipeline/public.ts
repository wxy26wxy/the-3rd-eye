/** Public (no-login) actions behind the shop and story-tag pages. */
import "server-only";
import { getOrderIdForToken, insertMessage, tapNfcToken, touchOrder, type MessageRow } from "@/lib/db/queries";
import { isNfcToken, normalizeNfcToken } from "@/lib/ids";
import { ApiError } from "@/lib/http";
import { notifyBuyerMessage } from "@/lib/notify/polling";
import { ai } from "@/lib/ai/registry";

/** Rejects unkind or unsafe buyer-written text (422 note_rejected) before it reaches a creator. */
export async function checkBuyerNote(text: string, task: string, jobId?: string): Promise<void> {
  const res = await (await ai()).moderator.checkNote(text, { trace: { stage: "moderate", task, jobId } });
  if (!res.ok) throw new ApiError(422, "note_rejected", "Please keep your note kind and friendly, then try again.");
}

export { placeOrder } from "@/lib/payments/staged";

export async function tap(token: string): Promise<{ tapCount: number }> {
  const t = normalizeNfcToken(token);
  const count = isNfcToken(t) ? await tapNfcToken(t) : null;
  if (count === null) throw new ApiError(404, "not_found", "Unknown story tag");
  return { tapCount: count };
}

export async function sendReply(token: string, body: string, task = "T010"): Promise<MessageRow> {
  const t = normalizeNfcToken(token);
  const order = isNfcToken(t) ? await getOrderIdForToken(t) : null;
  if (!order) throw new ApiError(404, "not_found", "Unknown story tag");
  const text = body.trim().slice(0, 2000);
  if (!text) throw new ApiError(400, "invalid_request", "Message is empty");
  await checkBuyerNote(text, task, order.orderId);
  const msg = await insertMessage({ orderId: order.orderId, direction: "buyer_to_creator", body: text, createdByTask: task });
  await touchOrder(order.orderId);
  await notifyBuyerMessage(order.creatorId, order.orderId);
  return msg;
}
