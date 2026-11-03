import { z } from "zod";
import { runPipeline } from "@/lib/pipeline/run";
import { requireCreator } from "@/lib/auth";
import { ApiError, json, parseJson, route } from "@/lib/http";
import { listArtworksWithProducts } from "@/lib/db/queries";
import { toArtwork, toArtworkListItem, toArtworkVariant, toCandidates } from "@/lib/api/dto";
import { createFromImage, createFromText } from "@/lib/pipeline/artworks";

export const maxDuration = 300;

const Body = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("text2image"), prompt: z.string().trim().min(1).max(4000), transcript: z.string().max(4000).optional(),
    product: z.enum(["sticker", "tote"]), n: z.number().int().min(1).max(4).optional(),
  }),
  z.object({
    source: z.enum(["photo", "canvas"]), imageUrl: z.string().min(1), product: z.enum(["sticker", "tote"]),
    /** T134: false = store the photo only (no SAM, `candidates: []`); the frame then goes to `detect`. */
    detect: z.boolean().optional(),
    /** T143 (round 4): the picture is the creator's crop; detection as `detect {box: [0,0,w,h]}`, the largest cut. */
    framed: z.boolean().optional(),
  }),
]);

export const POST = route(async (req) => {
  const { creatorId } = requireCreator(req);
  const body = await parseJson(req, Body);
  if (body.source === "text2image") {
    const rows = await runPipeline(() => createFromText(creatorId, { prompt: body.prompt, transcript: body.transcript, n: body.n ?? 2, product: body.product }));
    return json({ artworks: rows.map(toArtworkVariant) }, 201);
  }
  if (body.framed && body.detect === false) throw new ApiError(400, "invalid_request", "framed needs detection: leave detect out");
  const out = await runPipeline(() => createFromImage(creatorId, {
    source: body.source, imageUrl: body.imageUrl, product: body.product, detect: body.detect, framed: body.framed,
  }, body.framed ? "T143" : "T010"));
  return json({
    artwork: toArtwork(out.artwork), candidates: toCandidates(out.artwork), imageSize: out.imageSize,
    ...(out.details ? { details: out.details } : {}),
  }, 201);
});

export const GET = route(async (req) => {
  const { creatorId } = requireCreator(req);
  const rows = await listArtworksWithProducts(creatorId);
  return json({ artworks: rows.map(toArtworkListItem) });
});
