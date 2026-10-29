import { runPipeline } from "@/lib/pipeline/run";
import { requireCreator } from "@/lib/auth";
import { json, notFound, route } from "@/lib/http";
import { getArtwork, getProductForCreator } from "@/lib/db/queries";
import { runListingAgent } from "@/lib/pipeline/products";

export const maxDuration = 300;

export const POST = route<{ params: Promise<{ productId: string }> }>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { productId } = await params;
  const product = await getProductForCreator(productId, creatorId);
  if (!product) notFound("Product");
  const artwork = await getArtwork(product.artworkId);
  if (!artwork) notFound("Artwork");
  const { listing, trace } = await runPipeline(() => runListingAgent(product, artwork));
  return json({ listing, trace });
});
