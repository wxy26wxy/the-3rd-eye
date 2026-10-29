import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { ApiError, json, notFound, parseJson, route } from "@/lib/http";
import { getArtworkForCreator } from "@/lib/db/queries";
import { toArtwork } from "@/lib/api/dto";
import { cleanupArtwork } from "@/lib/pipeline/artworks";

export const maxDuration = 300;
const Point = z.object({ x: z.number().min(0), y: z.number().min(0) });
const Body = z.object({
  points: z.array(Point).min(1).max(10).optional(),
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  phrase: z.string().trim().min(1).max(80).optional(),
}).refine((b) => b.points || b.box || b.phrase, "Give points, a box or a phrase");

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { id } = await params;
  const hint = await parseJson(req, Body);
  const artwork = await getArtworkForCreator(id, creatorId);
  if (!artwork) notFound("Artwork");
  if (!artwork.originalUrl) throw new ApiError(400, "no_original", "This artwork has no original image");
  return json(toArtwork(await cleanupArtwork(artwork, hint)));
});
