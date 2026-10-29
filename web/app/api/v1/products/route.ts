import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { ApiError, json, notFound, parseJson, route } from "@/lib/http";
import { getArtworkForCreator } from "@/lib/db/queries";
import { toProduct } from "@/lib/api/dto";
import { createProduct } from "@/lib/pipeline/products";

export const maxDuration = 300;
const Body = z.object({ artworkId: z.string().uuid(), type: z.enum(["sticker", "tote"]) });

export const POST = route(async (req) => {
  const { creatorId } = requireCreator(req);
  const body = await parseJson(req, Body);
  const artwork = await getArtworkForCreator(body.artworkId, creatorId);
  if (!artwork) notFound("Artwork");
  if (artwork.status !== "ready") throw new ApiError(409, "artwork_not_ready", "Pick and clean up the artwork first");
  return json(toProduct(await createProduct(artwork, body.type)), 201);
});
