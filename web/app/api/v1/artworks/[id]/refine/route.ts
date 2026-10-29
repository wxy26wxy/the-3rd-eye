import { z } from "zod";
import { runPipeline } from "@/lib/pipeline/run";
import { requireCreator } from "@/lib/auth";
import { ApiError, json, notFound, parseJson, route } from "@/lib/http";
import { getArtworkForCreator } from "@/lib/db/queries";
import { toArtworkVariant } from "@/lib/api/dto";
import { refineArtwork } from "@/lib/pipeline/artworks";

export const maxDuration = 300;
const Body = z.object({ instruction: z.string().trim().min(1).max(1000) });

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { id } = await params;
  const { instruction } = await parseJson(req, Body);
  const artwork = await getArtworkForCreator(id, creatorId);
  if (!artwork) notFound("Artwork");
  if (!artwork.genResponseId) throw new ApiError(400, "not_refinable", "Only generated artwork can be changed by voice");
  return json({ artwork: toArtworkVariant(await runPipeline(() => refineArtwork(artwork, instruction))) }, 201);
});
