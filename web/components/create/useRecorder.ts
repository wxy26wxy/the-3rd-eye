"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "denied" | "unsupported";
const TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

function pickType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

/** Microphone recording with MediaRecorder. Stops automatically at `maxMs` (API limit 60 s). */
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
    r.onstop = () => {
      const blob = chunks.current.length ? new Blob(chunks.current, { type: r.mimeType || mimeType || "audio/webm" }) : null;
      cleanup();
      setStatus("idle");
      if (resolver.current) resolver.current(blob);
      else autoStop.current?.(blob);
      resolver.current = null;
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
