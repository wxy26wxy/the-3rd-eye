import { z } from "zod";
import { json, parseJson, route } from "@/lib/http";
import { placeOrder } from "@/lib/pipeline/public";

const Body = z.object({
  productId: z.string().uuid(),
  buyerName: z.string().trim().min(1).max(120),
  buyerEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  shipNote: z.string().trim().max(1000).optional(),
});

/** Public Buy (staged payments): `placeOrder` for clients that prefer HTTP over the lib function. */
export const POST = route(async (req) => {
  const { productId, ...input } = await parseJson(req, Body);
  return json(await placeOrder(productId, { ...input, buyerEmail: input.buyerEmail || undefined }), 201);
});
