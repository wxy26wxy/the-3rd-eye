import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/http";
import { listArtworksByCreator } from "@/lib/db/queries";
import { toArtwork, toArtworkVariant, toCandidates } from "@/lib/api/dto";
import { createFromImage, createFromText } from "@/lib/pipeline/artworks";

export const maxDuration = 300;

const Body = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("text2image"), prompt: z.string().trim().min(1).max(4000), transcript: z.string().max(4000).optional(),
    product: z.enum(["sticker", "tote"]), n: z.number().int().min(1).max(4).optional(),
  }),
  z.object({ source: z.enum(["photo", "canvas"]), imageUrl: z.string().min(1), product: z.enum(["sticker", "tote"]) }),
]);

export const POST = route(async (req) => {
  const { creatorId } = requireCreator(req);
  const body = await parseJson(req, Body);
  if (body.source === "text2image") {
    const rows = await createFromText(creatorId, { prompt: body.prompt, transcript: body.transcript, n: body.n ?? 2 });
    return json({ artworks: rows.map(toArtworkVariant) }, 201);
  }
  const { artwork } = await createFromImage(creatorId, { source: body.source, imageUrl: body.imageUrl });
  return json({ artwork: toArtwork(artwork), candidates: toCandidates(artwork) }, 201);
});

export const GET = route(async (req) => {
  const { creatorId } = requireCreator(req);
  const rows = await listArtworksByCreator(creatorId);
  return json({ artworks: rows.map(toArtwork) });
});
