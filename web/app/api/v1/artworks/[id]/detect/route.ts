import { runPipeline } from "@/lib/pipeline/run";
import { requireCreator } from "@/lib/auth";
import { ApiError, json, notFound, parseJson, route } from "@/lib/http";
import { getArtworkForCreator } from "@/lib/db/queries";
import { toArtwork, toCandidates } from "@/lib/api/dto";
import { DetectBody } from "@/lib/api/artwork-schemas";
import { assertPhotoRow, detectInBox } from "@/lib/pipeline/artworks";

export const maxDuration = 300;

/** Detection inside the frame (docs/api.md "Creator flow (round 3)"): SAM on the crop, the largest piece cut out, clipped. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { id } = await params;
  const { box } = await parseJson(req, DetectBody);
  const artwork = await getArtworkForCreator(id, creatorId);
  if (!artwork) notFound("Artwork");
  assertPhotoRow(artwork);
  if (!artwork.originalUrl) throw new ApiError(400, "no_original", "This artwork has no original image");
  const out = await runPipeline(() => detectInBox(artwork, box));
  return json({
    artwork: toArtwork(out.artwork), candidates: toCandidates(out.artwork), imageSize: out.imageSize,
    details: { failedProductIds: out.failedProductIds, unpublishedProductIds: out.unpublishedProductIds },
  });
});
