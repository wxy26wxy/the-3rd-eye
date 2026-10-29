import { z } from "zod";
import { runPipeline } from "@/lib/pipeline/run";
import { requireCreator } from "@/lib/auth";
import { ApiError, json, notFound, parseJson, route } from "@/lib/http";
import { getArtworkForCreator } from "@/lib/db/queries";
import { toArtwork } from "@/lib/api/dto";
import { selectCandidate } from "@/lib/pipeline/artworks";

export const maxDuration = 300;
const Body = z.object({ candidateId: z.string().min(1) });

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { id } = await params;
  const { candidateId } = await parseJson(req, Body);
  const artwork = await getArtworkForCreator(id, creatorId);
  if (!artwork) notFound("Artwork");
  if (!artwork.candidates?.some((c) => c.id === candidateId)) throw new ApiError(400, "invalid_candidate", "Pick one of the shown drawings");
  return json(toArtwork(await runPipeline(() => selectCandidate(artwork, candidateId))));
});
