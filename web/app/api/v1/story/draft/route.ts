import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { ApiError, json, notFound, parseJson, route } from "@/lib/http";
import { getCreatorById } from "@/lib/db/queries";
import { draftStoryFor } from "@/lib/pipeline/story";

export const maxDuration = 120;
/** `transcript` omitted → the creator's story-video transcript. The draft is stored as `storyDraft`. */
const Body = z.object({ transcript: z.string().trim().min(1).max(6000).optional(), mentionDisability: z.boolean() });

export const POST = route(async (req) => {
  const { creatorId } = requireCreator(req);
  const body = await parseJson(req, Body);
  const creator = await getCreatorById(creatorId);
  if (!creator) notFound("Creator");
  const transcript = body.transcript ?? creator.storyVideoTranscript;
  if (!transcript?.trim()) throw new ApiError(400, "invalid_request", "Say a few words first, or record a story video");
  const { draft } = await draftStoryFor(creatorId, transcript, { mentionDisability: body.mentionDisability });
  return json(draft);
});
