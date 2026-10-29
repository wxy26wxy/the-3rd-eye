import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { ApiError, json, notFound, parseJson, route } from "@/lib/http";
import { getOrderForCreator, touchOrder, upsertThankYou } from "@/lib/db/queries";
import { toThankYou } from "@/lib/api/dto";
import { isCreatorPath, storage } from "@/lib/storage";
import { ai } from "@/lib/ai/registry";

export const maxDuration = 300;
const Body = z.object({
  text: z.string().trim().max(2000).optional(),
  imageUrl: z.string().max(1000).optional(),
  videoUrl: z.string().max(1000).optional(),
  audioUrl: z.string().max(1000).optional(), // WAV of the video's soundtrack, used for captions
  transcript: z.string().trim().max(4000).optional(),
  draft: z.boolean().optional(),
});

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { creatorId } = requireCreator(req);
  const { id } = await params;
  const body = await parseJson(req, Body);
  const order = await getOrderForCreator(id, creatorId);
  if (!order) notFound("Order");
  const registry = await ai();

  if (body.draft) {
    if (!body.transcript) throw new ApiError(400, "invalid_request", "Say a few words first");
    const out = await registry.story.draftThankYou(body.transcript, { buyerName: order.buyerName, productTitle: order.productTitle ?? "your artwork" }, { trace: { stage: "story", task: "T010" } });
    return json({ draftText: out.text, provider: out.provider });
  }

  const videoPath = body.videoUrl?.replace(/^https?:\/\/[^/]+\//, "");
  if (videoPath && !isCreatorPath(videoPath, creatorId)) throw new ApiError(403, "forbidden_path", "That video does not belong to you");
  if (!body.text && !body.imageUrl && !videoPath) throw new ApiError(400, "invalid_request", "Add a note, a picture or a video");
  let videoVtt: string | null = null;
  if (videoPath) {
    try {
      const source = body.audioUrl ?? body.videoUrl!;
      const bytes = await storage().read(source);
      videoVtt = (await registry.captioner.caption(bytes, { filename: source.split("/").pop() ?? "video.mp4", trace: { stage: "captions", task: "T010" } })).vtt;
    } catch (err) {
      console.warn("[thank-you] captions failed:", err instanceof Error ? err.message : err);
    }
  }
  const row = await upsertThankYou({
    orderId: id, text: body.text ?? null, imageUrl: body.imageUrl ?? null, videoUrl: videoPath ?? null, videoVtt, createdByTask: "T010",
  });
  await touchOrder(id);
  return json(toThankYou(row), 201);
});
