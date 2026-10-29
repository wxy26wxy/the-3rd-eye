import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/http";
import { ai } from "@/lib/ai/registry";

export const maxDuration = 120;
const Body = z.object({ transcript: z.string().trim().min(1).max(6000), mentionDisability: z.boolean() });

export const POST = route(async (req) => {
  const { creatorId } = requireCreator(req);
  const body = await parseJson(req, Body);
  const draft = await (await ai()).story.draftStory(body.transcript, { mentionDisability: body.mentionDisability, trace: { stage: "story", task: "T010", jobId: creatorId } });
  return json(draft);
});
