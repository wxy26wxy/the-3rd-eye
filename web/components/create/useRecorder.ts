"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { blobToWav } from "@/lib/audio/wav";

export type RecorderStatus = "idle" | "recording" | "denied" | "unsupported";
const TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

function pickType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

/**
 * Microphone recording with MediaRecorder, delivered as 16 kHz mono WAV (`audio/wav`).
 * Stops automatically at `maxMs` (API limit 60 s). Resolves null if nothing was recorded or
 * the browser could not decode the recording.
 */
export function useRecorder({ maxMs = 60_000, onAutoStop }: { maxMs?: number; onAutoStop?: (blob: Blob | null) => void } = {}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolver = useRef<((b: Blob | null) => void) | null>(null);
  const autoStop = useRef(onAutoStop);
  useEffect(() => { autoStop.current = onAutoStop; }, [onAutoStop]);

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    rec.current?.stream.getTracks().forEach((t) => t.stop());
    rec.current = null;
  }, []);
  useEffect(() => () => cleanup(), [cleanup]);

  const stop = useCallback((): Promise<Blob | null> => {
    const r = rec.current;
    if (!r || r.state === "inactive") return Promise.resolve(null);
    return new Promise((resolve) => { resolver.current = resolve; r.stop(); });
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("unsupported");
      return false;
    }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { setStatus("denied"); return false; }
    const mimeType = pickType();
    const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
    r.onstop = async () => {
      const raw = chunks.current.length ? new Blob(chunks.current, { type: r.mimeType || mimeType || "audio/webm" }) : null;
      cleanup();
      // Transcribe accepts WAV only: convert to 16 kHz mono 16-bit PCM before handing it on.
      let wav: Blob | null = null;
      if (raw) {
        try { wav = await blobToWav(raw, maxMs / 1000); } catch (err) { console.error("WAV conversion failed", err); }
      }
      setStatus("idle");
      const done = resolver.current ?? autoStop.current;
      resolver.current = null;
      done?.(wav);
    };
    rec.current = r;
    r.start();
    setSeconds(0);
    setStatus("recording");
    const began = Date.now();
    timer.current = setInterval(() => {
      const s = Math.floor((Date.now() - began) / 1000);
      setSeconds(s);
      if (Date.now() - began >= maxMs && rec.current?.state === "recording") rec.current.stop();
    }, 250);
    return true;
  }, [cleanup, maxMs]);

  return { status, seconds, start, stop };
}
