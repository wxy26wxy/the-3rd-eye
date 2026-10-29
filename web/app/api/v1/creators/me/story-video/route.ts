import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/http";
import { updateCreator } from "@/lib/db/queries";
import { toCreator } from "@/lib/api/dto";
import { clientUploadPath, readClientUpload } from "@/lib/storage";
import { ai } from "@/lib/ai/registry";

export const maxDuration = 300;

/** `audioUrl` (optional): a WAV of the video's soundtrack; Voice Transcribe accepts WAV only and Vercel has no ffmpeg. */
const Body = z.object({ videoUrl: z.string().min(1), audioUrl: z.string().min(1).optional(), mentionDisability: z.boolean().optional() });

/** Stores the creator's story video pathname and generates WebVTT captions (Voice Transcribe). */
export const POST = route(async (req) => {
  const { creatorId } = requireCreator(req);
  const body = await parseJson(req, Body);
  const pathname = clientUploadPath(body.videoUrl, creatorId);
  if (body.audioUrl) clientUploadPath(body.audioUrl, creatorId);
  let captions: { vtt: string; transcript: string } | null = null;
  try {
    const source = body.audioUrl ?? body.videoUrl;
    const bytes = await readClientUpload(source, creatorId);
    captions = await (await ai()).captioner.caption(bytes, { filename: source.split("/").pop() ?? "video.mp4", trace: { stage: "captions", task: "T010" } });
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
