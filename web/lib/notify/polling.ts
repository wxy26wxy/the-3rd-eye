/**
 * Notifications are polled: the app calls GET /orders?since= every 10 s and reads `unread`.
 * Push can replace this module later; for now notify is a no-op.
 */
import "server-only";
import { unreadCountForCreator } from "@/lib/db/queries";

export async function notifyNewOrder(_creatorId: string, _orderId: string): Promise<void> {
  // Polling transport: nothing to send.
}

export async function notifyBuyerMessage(_creatorId: string, _orderId: string): Promise<void> {
  // Polling transport: nothing to send.
}

export function unreadCounts(creatorId: string): Promise<number> {
  return unreadCountForCreator(creatorId);
}
