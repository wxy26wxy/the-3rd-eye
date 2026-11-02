"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "@/components/messages";
import { transcribe } from "../api";
import { HydratingScreen, MissingState } from "../CreateScreen";
import { describeError, type ScreenError } from "../errors";
import { artOnScreen, skipChange, submitChange } from "../flow";
import { currentArtworkId, currentChange, getDraft, useCreate } from "../store";
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

type FocusTo = "stop" | "field" | "error";

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
  // Every phase renders a different tree: focus moves to the control the new phase is about.
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [focusTarget, setFocus] = useState<{ to: FocusTo; n: number } | null>(null);
  const focusOn = (to: FocusTo) => setFocus((f) => ({ to, n: (f?.n ?? 0) + 1 }));
  useEffect(() => {
    if (focusTarget?.to === "stop") stopRef.current?.focus();
    if (focusTarget?.to === "field") fieldRef.current?.focus();
    if (focusTarget?.to === "error") errorRef.current?.focus();
  }, [focusTarget]);

  function fail(err: unknown) {
    setError(describeError(err));
    setPhase("error");
    focusOn("error");
  }
  async function afterRecording(blob: Blob | null) {
    if (!live.current) return;
    if (!blob) { fail(null); return; }
    setPhase("transcribing");
    try {
      const text = await transcribe(blob);
      if (!live.current) return;
      setInstruction(text);
      setHeard(text);
      setPhase("idle");
      focusOn("field");
    } catch (err) {
      if (live.current) fail(err);
    }
  }
  async function record() {
    setError(null);
    typing.current = false;
    const ok = await recorder.start();
    if (ok && typing.current) { void recorder.stop(); return; }
    if (ok) { setPhase("listening"); focusOn("stop"); return; }
    // Microphone off (denied or unsupported): the typed path.
    setPhase("idle");
    focusOn("field");
  }
  async function stop() { await afterRecording(await recorder.stop()); }
  async function typeInstead() {
    typing.current = true;
    if (phase === "listening") await recorder.stop();
    setPhase("idle");
    focusOn("field");
  }
  const deps = { router, update, getDraft };
  function skip() {
    if (phase === "listening") void recorder.stop();
    skipChange(deps);
  }

  const micOff = recorder.status === "denied" ? m.create.speak.micDenied : recorder.status === "unsupported" ? m.create.speak.micUnsupported : null;
  const back = step ? "/create/compare" : (draft.candidates?.length ?? 0) > 1 ? "/create/pattern" : draft.method === "upload" ? "/create/photo?mode=upload" : "/create/photo?mode=camera";
  const art = artOnScreen(draft);
  return (
    <ChangeItView
      back={back}
      phase={phase}
      micOff={micOff}
      art={{ src: art.src, alt: art.alt ?? m.create.select.cutoutAlt }}
      shows={art.shows}
      instruction={instruction}
      seconds={recorder.seconds}
      error={error}
      announce={phase === "listening" ? m.create.speak.listening : ""}
      refs={{ field: fieldRef, stop: stopRef, error: errorRef }}
      on={{
        instruction: setInstruction,
        record: () => void record(),
        stop: () => void stop(),
        typeInstead: () => void typeInstead(),
        submit: () => { submitChange(deps, instruction, heard); },
        skip,
        retry: () => { setError(null); setPhase("idle"); void record(); },
        tryDifferent: () => { setError(null); setInstruction(""); setHeard(null); setPhase("idle"); focusOn("field"); },
      }}
    />
  );
}
