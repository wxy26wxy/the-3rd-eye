/** Client upload limits (POST /api/v1/uploads), by pathname `creators/<id>/<kind>/<uuid>.<ext>`. Pure. */
import { ApiError } from "@/lib/http";

const MB = 1024 * 1024;

const IMAGE = { types: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"], maxBytes: 25 * MB };
const VIDEO = { types: ["video/mp4", "video/quicktime"], maxBytes: 200 * MB };
const AUDIO = { types: ["audio/wav", "audio/x-wav", "audio/wave", "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/mpeg", "audio/webm", "audio/ogg"], maxBytes: 10 * MB };
const VIDEO_EXT = new Set(["mp4", "mov", "m4v"]);

/** Upload limits by pathname: `audio` kind → audio, video files (`story-video`, `thank-you`) → video, everything else → images. No SVG. */
export function uploadRule(pathname: string): { types: string[]; maxBytes: number } {
  const [, , kind, file = ""] = pathname.split("/");
  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "svg") throw new ApiError(400, "unsupported_type", "SVG files are not accepted");
  if (kind === "audio") return AUDIO;
  if (VIDEO_EXT.has(ext) || kind === "story-video") return VIDEO;
  return IMAGE;
}

