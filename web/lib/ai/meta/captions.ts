/**
 * Captions for story / thank-you videos: Voice Transcribe → WebVTT.
 * verified: 2026-10-28 — the API returns no timestamps (`turns` is empty), so cue times are
 * estimated: the measured `audioDurationMs` is split across sentence-sized cues by word count.
 */
import "server-only";
import type { Captioner, Captions, Trace } from "../types";
import { transcribeRequest } from "./transcribe";

export type Cue = { start: number; end: number; text: string };

function ts(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000), s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}

export function cuesToVtt(cues: Cue[]): string {
  return `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}`).join("\n\n")}\n`;
}

/** Splits text into cues of ≤ ~12 words (sentence boundaries first) spread over `durationSec`. */
export function estimateCues(text: string, durationSec?: number): Cue[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const chunks: string[] = [];
  for (const sentence of text.match(/[^.!?。]+[.!?。]*/g) ?? [text]) {
    const w = sentence.trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i < w.length; i += 12) chunks.push(w.slice(i, i + 12).join(" "));
  }
  const total = durationSec && durationSec > 0 ? durationSec : words.length / 2.5;
  const perWord = total / words.length;
  let t = 0;
  return chunks.map((c) => {
    const start = t;
    t += c.split(" ").length * perWord;
    return { start, end: t, text: c };
  });
}

export class MetaCaptioner implements Captioner {
  async caption(video: Blob | Buffer, opts: { filename: string; trace: Trace }): Promise<Captions> {
    const r = await transcribeRequest(video, { filename: opts.filename, stage: "captions", trace: opts.trace });
    return { transcript: r.text, vtt: cuesToVtt(estimateCues(r.text, r.durationMs ? r.durationMs / 1000 : undefined)) };
  }
}
