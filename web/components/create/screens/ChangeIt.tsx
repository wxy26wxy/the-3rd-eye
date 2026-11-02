"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "@/components/messages";
import { transcribe } from "../api";
import { HydratingScreen, MissingState } from "../CreateScreen";
import { describeError, type ScreenError } from "../errors";
import { currentArtworkId, currentChange, pieceCutout, useCreate } from "../store";
import { useRecorder } from "../useRecorder";
import { ChangeItView, type ChangePhase } from "./ChangeItView";

/**
 * Change it (R2): say or type what to change on the art on screen (the picked piece, or the last
 * change after "Change it again"). "Make the change" goes to Changing your art, which calls
 * `POST /artworks/{id}/change`; "Looks good as is" goes to the cutout of the art on screen.
 */
export function ChangeIt() {
  const { ready, draft } = useCreate();
  if (!ready) return <HydratingScreen title={m.create.result.titleEntry} />;
  if (!draft.pieceArtworkId || !draft.product) return <MissingState />;
  return <ChangeFlow key={currentArtworkId(draft)} />;
}

function ChangeFlow() {
  const router = useRouter();
  const { draft, update } = useCreate();
  const step = currentChange(draft);
  const [phase, setPhase] = useState<ChangePhase>("idle");
  const [instruction, setInstruction] = useState("");
  /** What the microphone heard, sent along when the request was spoken (and not retyped). */
  const [heard, setHeard] = useState<string | null>(null);
  const [error, setError] = useState<ScreenError | null>(null);
  const recorder = useRecorder({ onAutoStop: (b) => void afterRecording(b) });
  // "Type instead" while the browser's mic prompt is still open: a late grant must not start recording.
  const typing = useRef(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);

  async function afterRecording(blob: Blob | null) {
    if (!live.current) return;
    if (!blob) { setError(describeError(null)); setPhase("error"); return; }
    setPhase("transcribing");
    try {
      const text = await transcribe(blob);
      if (!live.current) return;
      setInstruction(text);
      setHeard(text);
      setPhase("idle");
    } catch (err) {
      if (!live.current) return;
      setError(describeError(err));
      setPhase("error");
    }
  }
  async function record() {
    setError(null);
    typing.current = false;
    const ok = await recorder.start();
    if (ok && typing.current) { void recorder.stop(); return; }
    if (ok) setPhase("listening");
  }
  async function stop() { await afterRecording(await recorder.stop()); }
  async function typeInstead() {
    typing.current = true;
    if (phase === "listening") await recorder.stop();
    setPhase("idle");
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>("textarea")?.focus());
  }
  function submit() {
    const text = instruction.trim();
    if (!text) return;
    update({ changeInstruction: text, changeTranscript: heard && heard.trim() === text ? heard : undefined });
    router.push("/create/changing");
  }
  /** "Looks good as is": the picked piece is already cut out (no call); a change result is cut on the next screen. */
  function skip() {
    if (phase === "listening") void recorder.stop();
    const target = step?.artworkId ?? draft.pieceArtworkId;
    const ready = pieceCutout(draft);
    update({ cutoutArtworkId: target, cutout: ready ?? (draft.cutout?.artworkId === target ? draft.cutout : undefined) });
    router.push("/create/cutout");
  }

  const micOff = recorder.status === "denied" ? m.create.speak.micDenied : recorder.status === "unsupported" ? m.create.speak.micUnsupported : null;
  const back = step ? "/create/compare" : (draft.candidates?.length ?? 0) > 1 ? "/create/pattern" : draft.method === "upload" ? "/create/photo?mode=upload" : "/create/photo?mode=camera";
  return (
    <ChangeItView
      back={back}
      phase={phase}
      micOff={micOff}
      art={{ src: step ? step.previewUrl : draft.pieceUrl ?? null, alt: (step ? step.alt : draft.pieceAlt) ?? m.create.select.cutoutAlt }}
      shows={step ? step.spoken ?? step.alt : draft.pieceSpoken ?? draft.pieceAlt ?? null}
      instruction={instruction}
      seconds={recorder.seconds}
      error={error}
      on={{
        instruction: setInstruction,
        record: () => void record(),
        stop: () => void stop(),
        typeInstead: () => void typeInstead(),
        submit,
        skip,
        retry: () => { setError(null); setPhase("idle"); void record(); },
        tryDifferent: () => { setError(null); setInstruction(""); setHeard(null); setPhase("idle"); },
      }}
    />
  );
}
