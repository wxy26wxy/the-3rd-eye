import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { json, notFound, parseJson, route } from "@/lib/http";
import { getOrderForCreator, insertMessage, listMessages, markBuyerMessagesRead, touchOrder } from "@/lib/db/queries";
import { toMessage } from "@/lib/api/dto";

export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { id } = await params;
  if (!(await getOrderForCreator(id, creatorId))) notFound("Order");
  const messages = await listMessages(id);
  await markBuyerMessagesRead(id);
  return json({ messages: messages.map(toMessage) });
});

const Body = z.object({ body: z.string().trim().min(1).max(2000) });

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { id } = await params;
  const { body } = await parseJson(req, Body);
  if (!(await getOrderForCreator(id, creatorId))) notFound("Order");
  const msg = await insertMessage({ orderId: id, direction: "creator_to_buyer", body, createdByTask: "T010" });
  await touchOrder(id);
  return json(toMessage(msg), 201);
});
