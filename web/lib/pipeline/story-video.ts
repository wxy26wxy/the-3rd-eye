/**
 * A creator's story video from a file the founder recorded outside the app (T151, round 7), the same
 * way `POST /creators/me/story-video` does it: the mp4 goes to the private store under
 * `creators/<id>/story-video/<uuid>.mp4` (the kind `/media` serves to anyone and the iOS/web uploads
 * use), the soundtrack is extracted locally with ffmpeg to the WAV Voice Transcribe accepts, captioned,
 * stored on the creator, and a story draft is made from the transcript (shown for Use / Edit / Skip,
 * never published). Used by `scripts/story_video.ts` (`pnpm story-video`). Dependencies are injected
 * so the logic is testable without ffmpeg, a network or a database.
 */
import "server-only";
import type { Captions } from "@/lib/ai/types";
import type { CreatorPatch, CreatorRow } from "@/lib/db/queries";

export const MAX_SECONDS = 60;
export const MAX_BYTES = 100 * 1024 * 1024;
export const STORY_VIDEO_KIND = "story-video";

export const USAGE = "usage: pnpm story-video <slug> <file.mp4> [--mention-disability] [--dry-run]   (--dry-run checks the file and captions it; no upload, no database call, so it does not check that the slug exists)";

export type StoryVideoArgs = { slug: string; file: string; mentionDisability?: true; dryRun: boolean };

export function parseStoryVideoArgs(argv: string[]): StoryVideoArgs {
  const positional: string[] = [];
  let dryRun = false;
  let mention = false;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    else if (a === "--mention-disability") mention = true;
    else if (a.startsWith("--")) throw new Error(`Unknown option ${a}`);
    else positional.push(a);
  }
  const [slug, file, ...rest] = positional;
  if (!slug || !file) throw new Error("A slug and a video file are needed");
  if (rest.length) throw new Error(`Unexpected argument ${rest[0]}`);
  return { slug, file, dryRun, ...(mention ? { mentionDisability: true as const } : {}) };
}

/** ffprobe arguments: format and streams as JSON, nothing else on stdout. */
export function ffprobeArgs(file: string): string[] {
  return ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file];
}

/** ffmpeg arguments: the soundtrack only, as 16 kHz mono 16-bit PCM WAV (what Voice Transcribe accepts). */
export function wavArgs(input: string, output: string): string[] {
  return ["-v", "error", "-nostdin", "-y", "-i", input, "-vn", "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-f", "wav", output];
}

export type Probe = { durationSec: number; sizeBytes: number; formatName: string; videoCodec: string | null; audioCodec: string | null };

type ProbeJson = { format?: { duration?: string; size?: string; format_name?: string }; streams?: { codec_type?: string; codec_name?: string }[] };

export function parseProbe(stdout: string): Probe {
  let data: ProbeJson;
  try {
    data = JSON.parse(stdout) as ProbeJson;
  } catch {
    throw new Error("ffprobe could not read the file");
  }
  const streams = data.streams ?? [];
  const codec = (type: string) => streams.find((s) => s.codec_type === type)?.codec_name ?? null;
  return {
    durationSec: Number(data.format?.duration ?? NaN),
    sizeBytes: Number(data.format?.size ?? NaN),
    formatName: data.format?.format_name ?? "",
    videoCodec: codec("video"),
    audioCodec: codec("audio"),
  };
}

/** Throws a plain-words error when the file is not a ≤ 60 s, ≤ 100 MB H.264/AAC mp4. */
export function checkProbe(p: Probe): void {
  if (!p.formatName.split(",").includes("mp4")) throw new Error(`Not an mp4 file (${p.formatName || "unknown format"})`);
  if (p.videoCodec !== "h264") throw new Error(`The video must be H.264 (found ${p.videoCodec ?? "no video"})`);
  if (p.audioCodec !== "aac") throw new Error(`The sound must be AAC (found ${p.audioCodec ?? "no sound"})`);
  if (!Number.isFinite(p.durationSec) || p.durationSec <= 0) throw new Error("Could not read the video's length");
  if (p.durationSec > MAX_SECONDS) throw new Error(`The video is ${p.durationSec.toFixed(1)} s; at most ${MAX_SECONDS} s`);
  if (!Number.isFinite(p.sizeBytes) || p.sizeBytes > MAX_BYTES) throw new Error(`The file is larger than ${MAX_BYTES / 1024 / 1024} MB`);
}

/** The first `n` cues of a WebVTT track as `start --> end  text` lines. */
export function firstCues(vtt: string, n = 2): string[] {
  return vtt.split(/\n\n+/).filter((b) => b.includes("-->")).slice(0, n).map((b) => {
    const lines = b.split("\n");
    const i = lines.findIndex((l) => l.includes("-->"));
    return `${lines[i]}  ${lines.slice(i + 1).join(" ")}`;
  });
}

/** The fields a new story video writes, exactly as the route: never the old captions; mentionDisability only when given. */
export function storyVideoPatch(pathname: string, captions: Captions | null, mentionDisability?: boolean): CreatorPatch {
  return {
    storyVideoUrl: pathname,
    storyVideoVtt: captions?.vtt ?? null,
    storyVideoTranscript: captions?.transcript ?? null,
    ...(mentionDisability !== undefined ? { mentionDisability } : {}),
  };
}

export type StoryVideoDeps = {
  /** ffprobe's JSON for the file. */
  probe(file: string): Promise<string>;
  /** The soundtrack as 16 kHz mono 16-bit WAV (made in a temporary folder). */
  extractWav(file: string): Promise<Buffer>;
  readFile(file: string): Promise<Buffer>;
  findCreator(slug: string): Promise<Pick<CreatorRow, "id"> | null>;
  /** Stores the mp4 in the private store; returns the logical pathname. */
  putVideo(creatorId: string, mp4: Buffer): Promise<string>;
  /** The creator's current story video pathname (read before the update), or null. */
  previousVideo(creatorId: string): Promise<string | null>;
  /** Removes a replaced video's blob from the store. */
  deleteVideo(pathname: string): Promise<void>;
  caption(wav: Buffer, jobId: string): Promise<Captions>;
  update(creatorId: string, patch: CreatorPatch): Promise<Pick<CreatorRow, "mentionDisability"> | null>;
  draft(creatorId: string, transcript: string, opts: { mentionDisability: boolean }): Promise<unknown>;
  log(line: string): void;
  warn(line: string): void;
};

export type StoryVideoResult = { durationSec: number; pathname: string | null; captions: Captions | null; drafted: boolean };

/** `pnpm story-video <slug> <file.mp4> [--mention-disability] [--dry-run]`. */
export async function storyVideo(deps: StoryVideoDeps, args: StoryVideoArgs): Promise<StoryVideoResult> {
  const probe = parseProbe(await deps.probe(args.file));
  checkProbe(probe);
  const wav = await deps.extractWav(args.file);
  deps.log(`slug: ${args.slug}`);
  deps.log(`duration: ${probe.durationSec.toFixed(1)} s`);

  if (args.dryRun) {
    const captions = await deps.caption(wav, args.slug);
    deps.log(`transcript: ${captions.transcript.trim() || "(silence: no captions would be stored)"}`);
    for (const cue of firstCues(captions.vtt)) deps.log(`cue: ${cue}`);
    deps.log("dry run: nothing uploaded, nothing written, slug not checked");
    return { durationSec: probe.durationSec, pathname: null, captions, drafted: false };
  }

  const creator = await deps.findCreator(args.slug);
  if (!creator) throw new Error(`No creator with slug "${args.slug}"`);
  const previous = await deps.previousVideo(creator.id);
  const pathname = await deps.putVideo(creator.id, await deps.readFile(args.file));
  deps.log(`stored: ${pathname}`);

  let captions: Captions | null = null;
  try {
    captions = await deps.caption(wav, creator.id);
    if (!captions.transcript.trim()) captions = null; // silence: no captions rather than an empty track
  } catch (err) {
    deps.warn(`[story-video] captions failed: ${err instanceof Error ? err.message : err}`);
  }
  // A new video never keeps the previous video's captions: null when captioning failed.
  const row = await deps.update(creator.id, storyVideoPatch(pathname, captions, args.mentionDisability));
  if (!row) throw new Error(`Could not update creator "${args.slug}"`);
  // T160: the replaced video's blob goes only after the row points at the new one (never the same file).
  if (previous && previous !== pathname) {
    try {
      await deps.deleteVideo(previous);
      deps.log(`removed previous video: ${previous}`);
    } catch (err) {
      deps.warn(`[story-video] could not delete the previous video: ${err instanceof Error ? err.message : err}`);
    }
  }

  let drafted = false;
  if (captions) {
    try {
      await deps.draft(creator.id, captions.transcript, { mentionDisability: row.mentionDisability ?? false });
      drafted = true;
    } catch (err) {
      deps.warn(`[story-video] story draft failed: ${err instanceof Error ? err.message : err}`);
    }
  } else {
    await deps.update(creator.id, { storyDraft: null });
  }
  if (captions) for (const cue of firstCues(captions.vtt)) deps.log(`cue: ${cue}`);
  else deps.log("captions: none (the video is stored without captions)");
  deps.log(`story draft: ${drafted ? "yes (shown in the app for Use / Edit / Skip)" : "no"}`);
  return { durationSec: probe.durationSec, pathname, captions, drafted };
}
