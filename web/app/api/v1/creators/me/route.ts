import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { json, notFound, parseJson, route } from "@/lib/http";
import { getCreatorById, updateCreator } from "@/lib/db/queries";
import { toCreator } from "@/lib/api/dto";

export const GET = route(async (req) => {
  const { creatorId } = requireCreator(req);
  const creator = await getCreatorById(creatorId);
  if (!creator) notFound("Creator");
  return json(toCreator(creator));
});

const AccessPrefs = z.object({
  voiceFirst: z.boolean(), simpleMode: z.boolean(), speakDescriptions: z.boolean(),
  highContrast: z.boolean(), largeText: z.boolean(), helperMode: z.boolean(),
}).partial();

const Body = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  studioName: z.string().trim().max(120).nullable().optional(),
  bioShort: z.string().trim().max(280).nullable().optional(),
  storyText: z.string().trim().max(4000).nullable().optional(),
  accessPrefs: AccessPrefs.optional(),
  mentionDisability: z.boolean().optional(),
  /** true discards the pending story draft (Skip); sending storyText also clears it. */
  dismissStoryDraft: z.boolean().optional(),
});

export const PUT = route(async (req) => {
  const { creatorId } = requireCreator(req);
  const body = await parseJson(req, Body);
  const current = await getCreatorById(creatorId);
  if (!current) notFound("Creator");
  const { accessPrefs, dismissStoryDraft, ...rest } = body;
  const updated = await updateCreator(creatorId, {
    ...rest, ...(accessPrefs ? { accessPrefs: { ...current.accessPrefs, ...accessPrefs } } : {}),
    ...(dismissStoryDraft || rest.storyText !== undefined ? { storyDraft: null } : {}),
  });
  return json(toCreator(updated!));
});
