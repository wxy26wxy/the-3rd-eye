/**
 * Muse Voice Transcribe 1.0 — plain fetch multipart to POST /v1/asr/transcribe.
 * verified: 2026-10-28 (probe). Request: multipart parts `request` (JSON
 * `{ model, audioEncoding: "WAV", language? }`) and `audio` (the file). WAV is the only
 * accepted encoding, so other formats are converted first (lib/audio/wav.ts).
 * Response: `{ sessionId, transcript, audioDurationMs, turns: [] }` — no timestamps.
 */
import "server-only";
import type { TranscribeProvider, TranscribeResult, Trace } from "../types";
import { traced } from "../trace";
import { META_BASE_URL, MODELS, metaApiKey } from "./client";
import { toWav } from "@/lib/audio/wav";

export type RawTranscript = { sessionId?: string; transcript?: string; text?: string; audioDurationMs?: number; turns?: unknown[] };
export type TranscriptWithDuration = TranscribeResult & { durationMs?: number };

export function normalizeTranscript(raw: RawTranscript, language?: string): TranscriptWithDuration {
  const text = String(raw.transcript ?? raw.text ?? "").replace(/[.。]{2,}$/, ".").trim();
  return { text, ...(language ? { language } : {}), ...(raw.audioDurationMs ? { durationMs: raw.audioDurationMs } : {}) };
}

/** Shared by transcribe and captions. */
export async function transcribeRequest(
  audio: Blob | Buffer,
  opts: { filename: string; language?: string; stage: string; trace?: Trace },
): Promise<TranscriptWithDuration> {
  const bytes = audio instanceof Blob ? Buffer.from(await audio.arrayBuffer()) : audio;
  const wav = await toWav(bytes, opts.filename);
  const request = { model: MODELS.transcribe, audioEncoding: "WAV", ...(opts.language ? { language: opts.language } : {}) };
  return traced(opts.stage, "meta", MODELS.transcribe, { request, audio: { filename: opts.filename, bytes: wav.length } }, async () => {
    const form = new FormData();
    form.append("request", new Blob([JSON.stringify(request)], { type: "application/json" }));
    form.append("audio", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), opts.filename.replace(/\.[^.]+$/, "") + ".wav");
    const res = await fetch(`${META_BASE_URL}/asr/transcribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${metaApiKey()}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`transcribe failed ${res.status}: ${body.slice(0, 300)}`);
    return normalizeTranscript(JSON.parse(body) as RawTranscript, opts.language);
  }, opts.trace);
}

export class MetaTranscriber implements TranscribeProvider {
  async transcribe(audio: Blob | Buffer, opts: { filename: string; language?: string; trace: Trace }): Promise<TranscribeResult> {
    const { text, language } = await transcribeRequest(audio, { ...opts, stage: "transcribe" });
    return { text, ...(language ? { language } : {}) };
  }
}
