/**
 * Muse Voice Transcribe accepts WAV only (verified 2026-10-28: `audioEncoding: "WAV"` is the
 * only accepted value). WAV input passes through; anything else is converted with ffmpeg
 * when one is available (FFMPEG_PATH or `ffmpeg` on PATH), else a 415 asks the client for WAV.
 */
import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApiError } from "@/lib/http";

export function isWav(buf: Buffer): boolean {
  return buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WAVE";
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += String(d); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-300)}`))));
  });
}

/** Returns 16 kHz mono 16-bit WAV bytes. */
export async function toWav(audio: Buffer, filename: string): Promise<Buffer> {
  if (isWav(audio)) return audio;
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const dir = await mkdtemp(join(tmpdir(), "ms-audio-"));
  const input = join(dir, `in-${filename.replace(/[^a-z0-9.]/gi, "") || "audio"}`);
  const output = join(dir, "out.wav");
  try {
    await writeFile(input, audio);
    await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", output]);
    return await readFile(output);
  } catch (err) {
    const missing = (err as NodeJS.ErrnoException).code === "ENOENT";
    throw new ApiError(415, "unsupported_audio",
      missing ? "Send audio as WAV (16-bit PCM); this server cannot convert other formats." : `Could not read the audio: ${(err as Error).message}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
