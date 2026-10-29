import { z } from "zod";
import { json, parseJson, route } from "@/lib/http";
import { sendReply } from "@/lib/pipeline/public";
import { toMessage } from "@/lib/api/dto";

const Body = z.object({ token: z.string().trim().min(1).max(32), body: z.string().trim().min(1).max(2000) });

export const POST = route(async (req) => {
  const { token, body } = await parseJson(req, Body);
  return json(toMessage(await sendReply(token, body)), 201);
});
