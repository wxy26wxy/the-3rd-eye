import { z } from "zod";
import { json, parseJson, route } from "@/lib/http";
import { tap } from "@/lib/pipeline/public";

const Body = z.object({ token: z.string().trim().min(1).max(32) });

export const POST = route(async (req) => {
  const { token } = await parseJson(req, Body);
  return json(await tap(token));
});
