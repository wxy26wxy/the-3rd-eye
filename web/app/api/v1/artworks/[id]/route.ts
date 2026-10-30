import { requireCreator } from "@/lib/auth";
import { json, notFound, route } from "@/lib/http";
import { deleteArtworkArchivingProducts, getArtworkForCreator } from "@/lib/db/queries";
import { toArtwork, toCandidates } from "@/lib/api/dto";
import { originalSize } from "@/lib/pipeline/artworks";
import { storage } from "@/lib/storage";

/** Presigned original lifetime (docs/api.md T080: 10 minutes). */
const ORIGINAL_URL_TTL_S = 600;

type Ctx = { params: Promise<{ id: string }> };

/** One artwork with its candidates, the original's size and a short-lived URL of the original. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { id } = await params;
  const artwork = await getArtworkForCreator(id, creatorId);
  if (!artwork) notFound("Artwork");
  const [imageSize, originalUrl] = await Promise.all([
    originalSize(artwork),
    artwork.originalUrl ? storage().signedUrl(artwork.originalUrl, ORIGINAL_URL_TTL_S) : Promise.resolve(null),
  ]);
  return json({ artwork: toArtwork(artwork), candidates: toCandidates(artwork), imageSize, originalUrl });
});

/** Soft delete; the artwork's products are archived (they leave the shop, orders keep rendering). */
export const DELETE = route<Ctx>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { id } = await params;
  const artwork = await getArtworkForCreator(id, creatorId);
  if (!artwork) notFound("Artwork");
  const archivedProductIds = await deleteArtworkArchivingProducts(artwork.id);
  return json({ id: artwork.id, deleted: true, archivedProductIds });
});
