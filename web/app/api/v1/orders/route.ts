import { requireCreator } from "@/lib/auth";
import { ApiError, json, route } from "@/lib/http";
import { listOrdersForCreator } from "@/lib/db/queries";
import { toOrderSummary } from "@/lib/api/dto";
import { unreadCounts } from "@/lib/notify/polling";

/** Poll every 10 s. `since` returns orders whose status, thank-you or messages changed after it. */
export const GET = route(async (req) => {
  const { creatorId } = requireCreator(req);
  const sinceParam = new URL(req.url).searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : undefined;
  if (since && Number.isNaN(since.getTime())) throw new ApiError(400, "invalid_since", "since must be an ISO date");
  const [orders, unread] = await Promise.all([listOrdersForCreator(creatorId, since), unreadCounts(creatorId)]);
  return json({ orders: orders.map(toOrderSummary), unread });
});
