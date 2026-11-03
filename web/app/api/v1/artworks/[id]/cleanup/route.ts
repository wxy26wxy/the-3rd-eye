import { runPipeline } from "@/lib/pipeline/run";
import { requireCreator } from "@/lib/auth";
import { ApiError, json, notFound, parseJson, route } from "@/lib/http";
import { getArtworkForCreator, listArtworkProductSummaries } from "@/lib/db/queries";
import { toArtwork, toArtworkProduct } from "@/lib/api/dto";
import { CleanupBody } from "@/lib/api/artwork-schemas";
import { cleanupArtwork } from "@/lib/pipeline/artworks";

export const maxDuration = 300;

/**
 * Re-cut: union of candidates and/or one SAM object from labelled points and a box (docs/api.md T080).
 * `products`: the row's live products after the rebuild (T143), so a client swaps to the new photo at once.
 */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { id } = await params;
  const hint = await parseJson(req, CleanupBody);
  const artwork = await getArtworkForCreator(id, creatorId);
  if (!artwork) notFound("Artwork");
  if (!artwork.originalUrl) throw new ApiError(400, "no_original", "This artwork has no original image");
  if (hint.candidateIds?.some((c) => !artwork.candidates?.some((k) => k.id === c))) {
    throw new ApiError(400, "invalid_candidate", "Pick one of the shown drawings");
  }
  const out = await runPipeline(() => cleanupArtwork(artwork, hint));
  const products = await listArtworkProductSummaries(artwork.id);
  return json({
    ...toArtwork(out.artwork), details: { failedProductIds: out.failedProductIds, unpublishedProductIds: out.unpublishedProductIds },
    products: products.map(toArtworkProduct),
  });
});
