import { z } from "zod";
import { runPipeline } from "@/lib/pipeline/run";
import { requireCreator } from "@/lib/auth";
import { ApiError, json, notFound, parseJson, route } from "@/lib/http";
import { getArtworkForCreator } from "@/lib/db/queries";
import { toProduct } from "@/lib/api/dto";
import { createProductOnce } from "@/lib/pipeline/products";
import { ClientRequestId, existingProduct } from "@/lib/pipeline/idempotency";

export const maxDuration = 300;
const Body = z.object({
  artworkId: z.string().uuid(), type: z.enum(["sticker", "tote"]),
  /** T134: idempotency key; a repeat answers 200 with the product the first call made. */
  clientRequestId: ClientRequestId.optional(),
});

export const POST = route(async (req) => {
  const { creatorId } = requireCreator(req);
  const body = await parseJson(req, Body);
  if (body.clientRequestId) {
    const done = await existingProduct(creatorId, body.clientRequestId, body.artworkId, body.type);
    if (done) return json(toProduct(done), 200);
  }
  const artwork = await getArtworkForCreator(body.artworkId, creatorId);
  if (!artwork) notFound("Artwork");
  if (artwork.status !== "ready") throw new ApiError(409, "artwork_not_ready", "Pick and clean up the artwork first");
  const { row, repeated } = await runPipeline(() => createProductOnce(artwork, body.type, "T010", body.clientRequestId));
  return json(toProduct(row), repeated ? 200 : 201);
});
