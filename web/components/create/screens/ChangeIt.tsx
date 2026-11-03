"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { api, transcribe } from "../api";
import { HydratingScreen, MissingState } from "../CreateScreen";
import { describeError, type ScreenError } from "../errors";
import { artOnScreen, changeItBack, changeItCut, changeItProduct, fixCutout, productPicture, runProduct, skipChange, submitChange } from "../flow";
import { currentArtworkId, cutoutOf, getDraft, once, updateDraft, useCreate } from "../store";
import { useRecorder } from "../useRecorder";
import { ChangeItView, type ChangePhase } from "./ChangeItView";

/**
 * Change it (R2): say or type what to change on the art on screen (the picked piece, or the last
 * change after "Change it again"). Round 4 ruling 2: it shows that art's sticker / tote bag; when it
 * is not made yet (or a re-cut rebuilt it), the making state runs `POST /products` here (the
 * Making screen is gone) and both buttons wait. "Make the change" goes to Changing your art
 * (change → cutout → products); "Looks good as is" goes to Ready on that product with no call;
 * "Fix the cutout" opens Your cutout of the art on screen.
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
  // Back opens the cut of the art on screen (T133), also after "Back to my original".
  const backCut = changeItCut(draft);
  useEffect(() => {
    if (backCut && getDraft().cutoutArtworkId !== backCut) update({ cutoutArtworkId: backCut });
  }, [backCut, update]);
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

  // The making state: the product for the art on screen, made (or its rebuilt photo read) here. The
  // call is shared by key, so a remount (Strict Mode, the kept-mounted route shown again) joins the
  // one in flight instead of sending a second POST (the key leaves out the request id, which
  // runProduct may mint mid-call); Try again resends the same clientRequestId.
  const product = changeItProduct(draft);
  const target = product.artworkId;
  const plan = product.plan;
  const cut = cutoutOf(draft, target)?.cleanedUrl ?? null;
  const [productError, setProductError] = useState<ScreenError | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!target || plan === "ready") return;
    let on = true;
    once(`product:${target}:${plan}:${cut}:${attempt}`, () => runProduct({ api, getDraft, update: updateDraft }, target))
      .catch((err) => { if (on) setProductError(describeError(err)); });
    return () => { on = false; };
  }, [target, plan, cut, attempt]);
  const tote = draft.product === "tote";
  // Review m1: the making status line unmounts when the photo arrives, so the live region says it.
  const [readyNote, setReadyNote] = useState("");
  const [lastPlan, setLastPlan] = useState(plan);
  if (lastPlan !== plan) {
    setLastPlan(plan);
    setReadyNote(plan === "ready" ? (tote ? m.create.result.readyTote : m.create.result.readySticker) : "");
  }
  const making = plan === "ready" ? null : {
    status: tote ? m.create.result.makingTote : m.create.result.makingSticker,
    hint: tote ? m.create.result.beingMadeTote : m.create.result.beingMadeSticker,
    error: productError,
  };
  function skip() {
    if (phase === "listening") void recorder.stop();
    skipChange(deps);
  }

  const micOff = recorder.status === "denied" ? m.create.speak.micDenied : recorder.status === "unsupported" ? m.create.speak.micUnsupported : null;
  const back = changeItBack(draft);
  const art = artOnScreen(draft);
  const photo = productPicture(draft, target);
  return (
    <ChangeItView
      back={back}
      phase={phase}
      micOff={micOff}
      art={{ src: photo.src, alt: fmt(m.create.result.productAlt, { product: tote ? m.common.tote.toLowerCase() : m.common.sticker.toLowerCase() }) }}
      making={making}
      canFix={!!backCut && backCut === target}
      shows={art.shows}
      instruction={instruction}
      seconds={recorder.seconds}
      error={error}
      announce={phase === "listening" ? m.create.speak.listening : readyNote}
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
        fix: () => { if (phase === "listening") void recorder.stop(); fixCutout(deps, "/create/change"); },
        retryProduct: () => { setProductError(null); setAttempt((a) => a + 1); },
      }}
    />
  );
}
