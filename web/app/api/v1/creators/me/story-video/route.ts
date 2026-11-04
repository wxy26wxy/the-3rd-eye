import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/http";
import { getCreatorById, updateCreator } from "@/lib/db/queries";
import { draftStoryFor } from "@/lib/pipeline/story";
import { toCreator } from "@/lib/api/dto";
import { clientUploadPath, readClientUpload, storage } from "@/lib/storage";
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
  const previous = (await getCreatorById(creatorId))?.storyVideoUrl ?? null; // read before the row changes
  let captions: { vtt: string; transcript: string } | null = null;
  try {
    const source = body.audioUrl ?? body.videoUrl;
    const bytes = await readClientUpload(source, creatorId);
    captions = await (await ai()).captioner.caption(bytes, { filename: source.split("/").pop() ?? "video.mp4", trace: { stage: "captions", task: "T050", jobId: creatorId } });
    if (!captions.transcript.trim()) captions = null; // silence: no captions rather than an empty track
  } catch (err) {
    console.warn("[story-video] captions failed:", err instanceof Error ? err.message : err);
  }
  // A new video never keeps the previous video's captions: null when captioning failed.
  let creator = await updateCreator(creatorId, {
    storyVideoUrl: pathname,
    storyVideoVtt: captions?.vtt ?? null,
    storyVideoTranscript: captions?.transcript ?? null,
    ...(body.mentionDisability !== undefined ? { mentionDisability: body.mentionDisability } : {}),
  });
  // T160: a replaced video's blob is removed once the row points at the new one (never before, never the same file).
  if (previous && previous !== pathname) {
    await storage().delete(previous).catch((err) => console.warn("[story-video] could not delete the previous video:", err instanceof Error ? err.message : err));
  }
  // Glimmer stage: draft a story from the creator's own words; shown for Use / Edit / Skip, never auto-published.
  if (captions) {
    const mention = creator?.mentionDisability ?? false; // already updated from the body above
    try {
      creator = (await draftStoryFor(creatorId, captions.transcript, { mentionDisability: mention })).creator ?? creator;
    } catch (err) {
      console.warn("[story-video] story draft failed:", err instanceof Error ? err.message : err);
    }
  } else {
    creator = await updateCreator(creatorId, { storyDraft: null });
  }
  return json(toCreator(creator!));
});
