import { z } from "zod";
import { runPipeline } from "@/lib/pipeline/run";
import { requireCreator } from "@/lib/auth";
import { json, notFound, parseJson, route } from "@/lib/http";
import { getArtworkForCreator } from "@/lib/db/queries";
import { toArtworkVariant } from "@/lib/api/dto";
import { changeArtwork, changeRepeat } from "@/lib/pipeline/artworks";
import { ClientRequestId, existingChange } from "@/lib/pipeline/idempotency";
import type { ArtworkRow } from "@/lib/db/queries";
import type { Description } from "@/lib/ai/types";

export const maxDuration = 300;
const Body = z.object({
  instruction: z.string().trim().min(1).max(1000), transcript: z.string().max(4000).optional(),
  /** T134: idempotency key; a repeat answers 200 with the row the first call made. */
  clientRequestId: ClientRequestId.optional(),
});

const answer = (artwork: ArtworkRow, description: Description, status: number) => json({
  artwork: toArtworkVariant(artwork),
  description: { alt: description.alt_text, spoken: description.spoken, differences: description.differences_from_prompt ?? "" },
}, status);

/** "Change it" (docs/api.md T111): Muse Image edits the picked piece; the result is a new child row. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { id } = await params;
  const body = await parseJson(req, Body);
  const parent = await getArtworkForCreator(id, creatorId);
  if (!parent) notFound("Artwork");
  if (body.clientRequestId) {
    const done = await existingChange(creatorId, body.clientRequestId, parent.id);
    if (done) {
      const again = await runPipeline(() => changeRepeat(done));
      return answer(again.artwork, again.description, 200);
    }
  }
  const { artwork, description, repeated } = await runPipeline(() => changeArtwork(parent, body));
  return answer(artwork, description, repeated ? 200 : 201);
});
