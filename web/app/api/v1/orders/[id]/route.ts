import { requireCreator } from "@/lib/auth";
import { json, notFound, route } from "@/lib/http";
import { getOrderForCreator, getThankYou, listMessages, markBuyerMessagesRead } from "@/lib/db/queries";
import { toMessage, toOrder, toThankYou } from "@/lib/api/dto";

export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { id } = await params;
  const order = await getOrderForCreator(id, creatorId);
  if (!order) notFound("Order");
  const [thankYou, messages] = await Promise.all([getThankYou(id), listMessages(id)]);
  await markBuyerMessagesRead(id);
  return json({ order: toOrder(order), thankYou: thankYou ? toThankYou(thankYou) : null, messages: messages.map(toMessage) });
});
