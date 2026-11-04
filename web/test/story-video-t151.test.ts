import { describe, expect, it } from "vitest";
import type { Captions } from "@/lib/ai/types";
import type { CreatorPatch } from "@/lib/db/queries";

const {
  parseStoryVideoArgs, ffprobeArgs, wavArgs, parseProbe, checkProbe, firstCues, storyVideoPatch, storyVideo,
  MAX_BYTES, STORY_VIDEO_KIND,
} = await import("@/lib/pipeline/story-video");
const { isPublicKind } = await import("@/lib/media-access");

/** ffprobe JSON as the founder's file reports it (30.0 s, H.264/AAC mp4, 23 MB). */
function probeJson(over: { duration?: string; size?: string; format?: string; video?: string | null; audio?: string | null } = {}) {
  const streams = [
    ...(over.video === null ? [] : [{ codec_type: "video", codec_name: over.video ?? "h264" }]),
    ...(over.audio === null ? [] : [{ codec_type: "audio", codec_name: over.audio ?? "aac" }]),
  ];
  return JSON.stringify({ streams, format: { format_name: over.format ?? "mov,mp4,m4a,3gp,3g2,mj2", duration: over.duration ?? "30.000000", size: over.size ?? "23456789" } });
}

const VTT = "WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.880\nMy name is June.\n\n2\n00:00:01.880 --> 00:00:04.000\nI paint on Tuesdays.\n\n3\n00:00:04.000 --> 00:00:05.000\nThank you.\n";
const CAPTIONS: Captions = { vtt: VTT, transcript: "My name is June. I paint on Tuesdays. Thank you." };

function deps(opts: { caption?: () => Promise<Captions>; draft?: () => Promise<unknown>; mention?: boolean; creator?: boolean } = {}) {
  const calls: string[] = [];
  const updates: CreatorPatch[] = [];
  const lines: string[] = [];
  const warnings: string[] = [];
  return {
    calls, updates, lines, warnings,
    d: {
      probe: async (f: string) => { calls.push(`probe ${f}`); return probeJson(); },
      extractWav: async (f: string) => { calls.push(`wav ${f}`); return Buffer.from("RIFF"); },
      readFile: async (f: string) => { calls.push(`read ${f}`); return Buffer.from("mp4"); },
      findCreator: async (slug: string) => { calls.push(`find ${slug}`); return opts.creator === false ? null : { id: "c1" }; },
      putVideo: async (id: string) => { calls.push(`put ${id}`); return `creators/${id}/story-video/u1.mp4`; },
      caption: async (_wav: Buffer, jobId: string) => { calls.push(`caption ${jobId}`); return (opts.caption ?? (async () => CAPTIONS))(); },
      update: async (id: string, patch: CreatorPatch) => { calls.push(`update ${id}`); updates.push(patch); return { mentionDisability: patch.mentionDisability ?? opts.mention ?? false }; },
      draft: async (id: string, _t: string, o: { mentionDisability: boolean }) => { calls.push(`draft ${id} ${o.mentionDisability}`); return (opts.draft ?? (async () => ({})))(); },
      log: (l: string) => lines.push(l),
      warn: (l: string) => warnings.push(l),
    },
  };
}

describe("pnpm story-video: arguments and checks (T151)", () => {
  it("parses the slug, the file and the two flags", () => {
    expect(parseStoryVideoArgs(["june-park", "v.mp4"])).toEqual({ slug: "june-park", file: "v.mp4", dryRun: false });
    expect(parseStoryVideoArgs(["--dry-run", "june-park", "v.mp4", "--mention-disability"]))
      .toEqual({ slug: "june-park", file: "v.mp4", dryRun: true, mentionDisability: true });
    expect(() => parseStoryVideoArgs(["june-park"])).toThrow(/slug and a video file/);
    expect(() => parseStoryVideoArgs(["june-park", "v.mp4", "--force"])).toThrow(/Unknown option --force/);
    expect(() => parseStoryVideoArgs(["june-park", "v.mp4", "extra"])).toThrow(/Unexpected argument/);
  });

  it("reads ffprobe's JSON and accepts a 30 s H.264/AAC mp4", () => {
    const p = parseProbe(probeJson());
    expect(p).toEqual({ durationSec: 30, sizeBytes: 23456789, formatName: "mov,mp4,m4a,3gp,3g2,mj2", videoCodec: "h264", audioCodec: "aac" });
    expect(() => checkProbe(p)).not.toThrow();
    expect(ffprobeArgs("v.mp4")).toEqual(["-v", "error", "-print_format", "json", "-show_format", "-show_streams", "v.mp4"]);
    expect(() => parseProbe("not json")).toThrow(/ffprobe could not read/);
  });

  it("refuses long, large, non-mp4, non-H.264, non-AAC or silent-track files", () => {
    const bad = (o: Parameters<typeof probeJson>[0]) => () => checkProbe(parseProbe(probeJson(o)));
    expect(bad({ duration: "60.0" })).not.toThrow();
    expect(bad({ duration: "60.5" })).toThrow(/60.5 s; at most 60 s/);
    expect(bad({ size: String(MAX_BYTES + 1) })).toThrow(/larger than 100 MB/);
    expect(bad({ format: "matroska,webm" })).toThrow(/Not an mp4/);
    expect(bad({ video: "hevc" })).toThrow(/H.264 \(found hevc\)/);
    expect(bad({ audio: "opus" })).toThrow(/AAC \(found opus\)/);
    expect(bad({ audio: null })).toThrow(/found no sound/);
  });

  it("extracts the soundtrack as 16 kHz mono 16-bit PCM WAV", () => {
    const a = wavArgs("in.mp4", "out.wav");
    const after = (flag: string) => a[a.indexOf(flag) + 1];
    expect([after("-i"), after("-ac"), after("-ar"), after("-c:a"), after("-f")]).toEqual(["in.mp4", "1", "16000", "pcm_s16le", "wav"]);
    expect(a).toContain("-vn");
    expect(a[a.length - 1]).toBe("out.wav");
  });

  it("stores under the story-video kind, which /media serves to anyone", () => {
    expect(isPublicKind(`creators/c1/${STORY_VIDEO_KIND}/u1.mp4`)).toBe(true);
  });

  it("lists the first two cues", () => {
    expect(firstCues(VTT)).toEqual(["00:00:00.000 --> 00:00:01.880  My name is June.", "00:00:01.880 --> 00:00:04.000  I paint on Tuesdays."]);
  });
});

describe("pnpm story-video: the run (pipeline mocked)", () => {
  it("uploads, captions, writes the route's fields and drafts a story", async () => {
    const t = deps();
    const out = await storyVideo(t.d, { slug: "june-park", file: "v.mp4", dryRun: false });
    expect(t.calls).toEqual(["probe v.mp4", "wav v.mp4", "find june-park", "read v.mp4", "put c1", "caption c1", "update c1", "draft c1 false"]);
    expect(t.updates).toEqual([{ storyVideoUrl: "creators/c1/story-video/u1.mp4", storyVideoVtt: VTT, storyVideoTranscript: CAPTIONS.transcript }]);
    expect(out).toMatchObject({ pathname: "creators/c1/story-video/u1.mp4", drafted: true, durationSec: 30 });
    expect(t.lines).toEqual([
      "slug: june-park", "duration: 30.0 s", "stored: creators/c1/story-video/u1.mp4",
      "cue: 00:00:00.000 --> 00:00:01.880  My name is June.", "cue: 00:00:01.880 --> 00:00:04.000  I paint on Tuesdays.",
      "story draft: yes (shown in the app for Use / Edit / Skip)",
    ]);
  });

  it("sets mentionDisability only when the flag is given, and drafts with it", async () => {
    const t = deps();
    await storyVideo(t.d, { slug: "june-park", file: "v.mp4", dryRun: false, mentionDisability: true });
    expect(t.updates[0]).toMatchObject({ mentionDisability: true });
    expect(t.calls).toContain("draft c1 true");
    expect(storyVideoPatch("p", null)).not.toHaveProperty("mentionDisability");
    const kept = deps({ mention: true });
    await storyVideo(kept.d, { slug: "june-park", file: "v.mp4", dryRun: false });
    expect(kept.updates[0]).not.toHaveProperty("mentionDisability");
    expect(kept.calls).toContain("draft c1 true"); // the stored choice is used
  });

  it("never keeps the old captions: a failed or silent captioning stores nulls and clears the draft", async () => {
    for (const caption of [async () => { throw new Error("transcribe 500"); }, async () => ({ vtt: "WEBVTT\n", transcript: "  " })]) {
      const t = deps({ caption });
      const out = await storyVideo(t.d, { slug: "june-park", file: "v.mp4", dryRun: false });
      expect(t.updates).toEqual([
        { storyVideoUrl: "creators/c1/story-video/u1.mp4", storyVideoVtt: null, storyVideoTranscript: null },
        { storyDraft: null },
      ]);
      expect(t.calls).not.toContain("draft c1 false");
      expect(out.drafted).toBe(false);
      expect(t.lines).toContain("story draft: no");
    }
    const failed = deps({ caption: async () => { throw new Error("transcribe 500"); } });
    await storyVideo(failed.d, { slug: "june-park", file: "v.mp4", dryRun: false });
    expect(failed.warnings).toEqual(["[story-video] captions failed: transcribe 500"]);
  });

  it("warns like the route when the story draft fails, and keeps the captions", async () => {
    const t = deps({ draft: async () => { throw new Error("ollama down"); } });
    const out = await storyVideo(t.d, { slug: "june-park", file: "v.mp4", dryRun: false });
    expect(t.warnings).toEqual(["[story-video] story draft failed: ollama down"]);
    expect(out).toMatchObject({ drafted: false, captions: CAPTIONS });
    expect(t.updates).toHaveLength(1);
  });

  it("dry run: checks, WAV and captions only; no lookup, upload or write; prints the transcript", async () => {
    const t = deps();
    const out = await storyVideo(t.d, { slug: "june-park", file: "v.mp4", dryRun: true });
    expect(t.calls).toEqual(["probe v.mp4", "wav v.mp4", "caption june-park"]);
    expect(t.updates).toEqual([]);
    expect(out.pathname).toBeNull();
    expect(t.lines).toContain(`transcript: ${CAPTIONS.transcript}`);
    expect(t.lines.at(-1)).toBe("dry run: nothing uploaded, nothing written, slug not checked");
  });

  it("stops before any write on a bad file or an unknown slug", async () => {
    const bad = deps();
    bad.d.probe = async () => probeJson({ duration: "75" });
    await expect(storyVideo(bad.d, { slug: "june-park", file: "v.mp4", dryRun: false })).rejects.toThrow(/at most 60 s/);
    expect(bad.calls).toEqual([]);
    const none = deps({ creator: false });
    await expect(storyVideo(none.d, { slug: "nobody", file: "v.mp4", dryRun: false })).rejects.toThrow(/No creator with slug "nobody"/);
    expect(none.calls).not.toContain("put c1");
    expect(none.updates).toEqual([]);
  });
});
