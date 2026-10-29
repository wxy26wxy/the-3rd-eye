import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/http";
import { ai } from "@/lib/ai/registry";

const Body = z.object({
  transcript: z.string().trim().min(1).max(2000),
  answers: z.array(z.string().max(1000)).max(5).optional(),
  product: z.enum(["sticker", "tote"]),
});

export const POST = route(async (req) => {
  const { creatorId } = requireCreator(req);
  const body = await parseJson(req, Body);
  const shaped = await (await ai()).shaper.shape(body.transcript, { answers: body.answers, product: body.product, trace: { stage: "shape", task: "T010", jobId: creatorId } });
  return json(shaped);
});
