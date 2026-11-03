import { requireCreator } from "@/lib/auth";
import { json, notFound, route } from "@/lib/http";
import { getListing, getProductForCreator } from "@/lib/db/queries";
import { toListing, toListingDraft, toProduct } from "@/lib/api/dto";

/** Recovery and the drafting screen (T134): the product, its saved listing and the last run's draft (nulls before a run). */
export const GET = route<{ params: Promise<{ productId: string }> }>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { productId } = await params;
  const product = await getProductForCreator(productId, creatorId);
  if (!product) notFound("Product");
  const listing = await getListing(product.id);
  return json({ product: toProduct(product), listing: listing ? toListing(listing) : null, draft: listing ? toListingDraft(listing) : null });
});
