import { z } from "zod";
import { runPipeline } from "@/lib/pipeline/run";
import { requireCreator } from "@/lib/auth";
import { json, notFound, parseJson, route } from "@/lib/http";
import { getProductForCreator } from "@/lib/db/queries";
import { toListing, toProduct } from "@/lib/api/dto";
import { approveListing } from "@/lib/pipeline/products";

export const maxDuration = 300;
const Body = z.object({
  approvedVia: z.enum(["voice", "tap"]),
  edits: z.object({
    title: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(2000).optional(),
    priceCents: z.number().int().min(100).max(100_000).optional(),
  }).optional(),
  /** T134: publish despite a contrast warning (a resolution failure still blocks). */
  acceptPrintWarning: z.boolean().optional(),
});

export const POST = route<{ params: Promise<{ productId: string }> }>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { productId } = await params;
  const body = await parseJson(req, Body);
  const product = await getProductForCreator(productId, creatorId);
  if (!product) notFound("Product");
  const out = await runPipeline(() => approveListing(product, body));
  return json({ product: toProduct(out.product), listing: toListing(out.listing), storyVideoNeeded: out.storyVideoNeeded });
});
