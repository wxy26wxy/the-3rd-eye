import { runPipeline } from "@/lib/pipeline/run";
import { requireCreator } from "@/lib/auth";
import { ApiError, json, notFound, route } from "@/lib/http";
import { getArtworkForCreator } from "@/lib/db/queries";
import { toArtwork, toCandidates } from "@/lib/api/dto";
import { assertChangeResult, cutoutArtwork } from "@/lib/pipeline/artworks";

export const maxDuration = 300;

/** Cutout after "Change it" (docs/api.md T111): SAM pieces of the stored picture, the largest cut out. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { id } = await params;
  const artwork = await getArtworkForCreator(id, creatorId);
  if (!artwork) notFound("Artwork");
  assertChangeResult(artwork);
  if (!artwork.originalUrl) throw new ApiError(400, "no_original", "This artwork has no original image");
  const out = await runPipeline(() => cutoutArtwork(artwork));
  return json({ artwork: toArtwork(out.artwork), candidates: toCandidates(out.artwork), imageSize: out.imageSize });
});
