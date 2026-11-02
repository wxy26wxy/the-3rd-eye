import { z } from "zod";
import { runPipeline } from "@/lib/pipeline/run";
import { requireCreator } from "@/lib/auth";
import { json, notFound, parseJson, route } from "@/lib/http";
import { getArtworkForCreator } from "@/lib/db/queries";
import { toArtworkVariant } from "@/lib/api/dto";
import { changeArtwork } from "@/lib/pipeline/artworks";

export const maxDuration = 300;
const Body = z.object({ instruction: z.string().trim().min(1).max(1000), transcript: z.string().max(4000).optional() });

/** "Change it" (docs/api.md T111): Muse Image edits the picked piece; the result is a new child row. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { id } = await params;
  const body = await parseJson(req, Body);
  const parent = await getArtworkForCreator(id, creatorId);
  if (!parent) notFound("Artwork");
  const { artwork, description } = await runPipeline(() => changeArtwork(parent, body));
  return json({
    artwork: toArtworkVariant(artwork),
    description: { alt: description.alt_text, spoken: description.spoken, differences: description.differences_from_prompt ?? "" },
  }, 201);
});
