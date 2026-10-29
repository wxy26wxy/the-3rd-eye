/**
 * Notifications are polled: the app calls GET /orders?since= every 10 s and reads `unread`.
 * Push can replace this module later; for now notify is a no-op.
 */
import "server-only";
import { unreadCountForCreator } from "@/lib/db/queries";

export async function notifyNewOrder(creatorId: string, orderId: string): Promise<void> {
  void creatorId; void orderId; // polling transport: nothing to send
}

export async function notifyBuyerMessage(creatorId: string, orderId: string): Promise<void> {
  void creatorId; void orderId; // polling transport: nothing to send
}

export function unreadCounts(creatorId: string): Promise<number> {
  return unreadCountForCreator(creatorId);
}
