import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { ApiError, json, parseJson, route } from "@/lib/http";
import { updateCreator } from "@/lib/db/queries";
import { toCreator } from "@/lib/api/dto";
import { isCreatorPath, storage } from "@/lib/storage";
import { ai } from "@/lib/ai/registry";

export const maxDuration = 300;

const Body = z.object({ videoUrl: z.string().min(1), mentionDisability: z.boolean().optional() });

/** Stores the creator's story video pathname and generates WebVTT captions (Voice Transcribe). */
export const POST = route(async (req) => {
  const { creatorId } = requireCreator(req);
  const body = await parseJson(req, Body);
  const pathname = body.videoUrl.replace(/^https?:\/\/[^/]+\//, "");
  if (!isCreatorPath(pathname, creatorId)) throw new ApiError(403, "forbidden_path", "That video does not belong to you");
  let captions: { vtt: string; transcript: string } | null = null;
  try {
    const bytes = await storage().read(body.videoUrl);
    captions = await (await ai()).captioner.caption(bytes, { filename: pathname.split("/").pop() ?? "video.mp4", trace: { stage: "captions", task: "T010" } });
  } catch (err) {
    console.warn("[story-video] captions failed:", err instanceof Error ? err.message : err);
  }
  const creator = await updateCreator(creatorId, {
    storyVideoUrl: pathname,
    ...(captions ? { storyVideoVtt: captions.vtt, storyVideoTranscript: captions.transcript } : {}),
    ...(body.mentionDisability !== undefined ? { mentionDisability: body.mentionDisability } : {}),
  });
  return json(toCreator(creator!));
});
