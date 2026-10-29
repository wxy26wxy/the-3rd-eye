import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { ApiError, json, route } from "@/lib/http";
import { readClientUpload } from "@/lib/storage";
import { ai } from "@/lib/ai/registry";

export const maxDuration = 120;
const MAX_BYTES = 4 * 1024 * 1024;
const Json = z.object({ audioUrl: z.string().min(1), language: z.string().max(10).optional() });

/** multipart `file` (wav/m4a/mp3/webm, ≤ 4 MB, ≤ 60 s) or JSON `{ audioUrl }` → `{ text, language? }`. */
export const POST = route(async (req) => {
  const { creatorId } = requireCreator(req);
  let bytes: Buffer;
  let filename = "audio.wav";
  let language: string | undefined;
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "invalid_request", "Send the recording as a `file` field");
    if (file.size > MAX_BYTES) throw new ApiError(413, "too_large", "Recording is too long; keep it under a minute");
    bytes = Buffer.from(await file.arrayBuffer());
    filename = file.name || filename;
    language = typeof form.get("language") === "string" ? String(form.get("language")) : undefined;
  } else {
    const body = Json.parse(await req.json().catch(() => ({})));
    bytes = await readClientUpload(body.audioUrl, creatorId, MAX_BYTES);
    filename = body.audioUrl.split("/").pop() ?? filename;
    language = body.language;
  }
  const result = await (await ai()).transcribe.transcribe(bytes, { filename, language, trace: { stage: "transcribe", task: "T010", jobId: creatorId } });
  return json(result);
});
