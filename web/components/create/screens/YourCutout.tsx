"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { api } from "../api";
import { HydratingScreen, MissingState } from "../CreateScreen";
import {
  centrePoint, marksRequest, MAX_POINTS, needsTrimAdvice, sameMarks, usableSize, wholeImageBox,
  type CleanupRequest, type CutoutPoint, type XY,
} from "../cutout";
import { describeError, type ScreenError } from "../errors";
import { applyMarks, areaNotFound, cutIsChange, cutoutVisit, makingCutoutBack, pickRequest, runAreaCut, runChangeCut, showsPieces, takeCutout, yourCutoutBack } from "../flow";
import { cutoutOf, getDraft, once, resetDraft, updateDraft, useCreate, type CutoutState, type Draft } from "../store";
import { useOriginal } from "../useOriginal";
import { areaError, isNotFound } from "./AdjustArea";
import { CutoutPhoto, type TapMode } from "./CutoutPhoto";
import { MakingCutoutView } from "./MakingCutoutView";
import { YourCutoutView } from "./YourCutoutView";

const t = m.create.select;
const c = m.create.cutout;
const MODES: { id: TapMode; label: string }[] = [
  { id: "add", label: t.modeAdd },
  { id: "remove", label: t.modeRemove },
];
const flowDeps = { api, getDraft, update: updateDraft };

function cleanupError(err: unknown, sent: CleanupRequest | null): ScreenError {
  return needsTrimAdvice(err, sent) ? { message: t.instruction, action: "none" } : describeError(err);
}

/**
 * /create/cutout (T130). Making your cutout runs the cut the draft is waiting for: the frame from
 * Adjust the area (`cleanup {candidateIds?, box, clipToBox: true}`), or a change result's
 * `POST /artworks/{id}/cutout` (once per artwork). Then Your cutout: the cut, with Add area /
 * Remove area marks and Apply cutout on "Fix the edges".
 */
export function Cutout() {
  const { ready, draft } = useCreate();
  if (!ready) return <HydratingScreen title={c.title} />;
  const visit = draft.product ? cutoutVisit(draft) : "missing";
  const target = draft.cutoutArtworkId as string;
  if (visit === "cut") return <YourCutoutFlow key={target} cutout={cutoutOf(draft, target) as CutoutState} />;
  if (visit === "area") return <MakingArea key={draft.pendingArea?.nonce} job={draft.pendingArea as NonNullable<Draft["pendingArea"]>} />;
  if (visit === "change") return <MakingChangeCut key={target} artworkId={target} />;
  return <MissingState />;
}

/**
 * Making your cutout for "Use this area" (`detect` inside the frame); a frame with nothing in it goes
 * back to Adjust the area, which says to move or grow it.
 */
function MakingArea({ job }: { job: NonNullable<Draft["pendingArea"]> }) {
  const router = useRouter();
  const [error, setError] = useState<ScreenError | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    // The draft is updated even after a navigation away; only a result for this frame counts.
    once(`area:${job.nonce}:${attempt}`, () => runAreaCut(flowDeps, job)).catch((err) => {
      if (isNotFound(err)) { areaNotFound({ ...flowDeps, router }, job); return; }
      if (live) setError(areaError(err));
    });
    return () => { live = false; };
  }, [job, attempt, router]);
  return (
    <MakingCutoutView
      changed={false}
      error={error}
      back={makingCutoutBack("area")}
      onRetry={() => { setError(null); setAttempt((a) => a + 1); }}
    />
  );
}

/** Making your cutout for a change result (`cutout`, SAM picks the largest piece). */
function MakingChangeCut({ artworkId }: { artworkId: string }) {
  const [error, setError] = useState<ScreenError | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    // Nothing found on the changed picture shows the API's reason; Back returns to Before and after.
    once(`cutout:${artworkId}:${attempt}`, () => runChangeCut(flowDeps, artworkId)).catch((err) => { if (live) setError(describeError(err)); });
    return () => { live = false; };
  }, [artworkId, attempt]);
  return (
    <MakingCutoutView
      changed
      error={error}
      back={makingCutoutBack("change")}
      onRetry={() => { setError(null); setAttempt((a) => a + 1); }}
    />
  );
}

type Work = "apply" | "use";

function YourCutoutFlow({ cutout }: { cutout: CutoutState }) {
  const router = useRouter();
  const uid = useId();
  const { draft } = useCreate();
  const artworkId = cutout.artworkId;
  const changed = cutIsChange(draft, artworkId);
  const [points, setPoints] = useState<CutoutPoint[]>(cutout.points);
  const [mode, setMode] = useState<TapMode>("add");
  const [showCut, setShowCut] = useState(true);
  const [work, setWork] = useState<Work | null>(null);
  const [failed, setFailed] = useState<Work | null>(null);
  const [error, setError] = useState<ScreenError | null>(null);
  const [notice, setNotice] = useState<string | null>(draft.cutoutNotice ?? null);
  const [announce, setAnnounce] = useState("");
  const { detail, onImageError } = useOriginal(artworkId);
  const busy = work !== null;
  const inFlight = useRef(false);
  const live = useRef(true);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLFieldSetElement>(null);
  const [focusTarget, setFocus] = useState<{ to: "result" | "error" | "tools"; n: number } | null>(null);
  const focusOn = (to: "result" | "error" | "tools") => setFocus((f) => ({ to, n: (f?.n ?? 0) + 1 }));
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => {
    if (focusTarget?.to === "result") resultRef.current?.focus();
    if (focusTarget?.to === "error") errorRef.current?.focus();
    // Fix the edges (T133): the chosen tool, else the first control of the view (the picture is still loading).
    if (focusTarget?.to === "tools") (toolsRef.current?.querySelector<HTMLInputElement>("input:checked") ?? document.querySelector<HTMLElement>("main button, main a"))?.focus();
  }, [focusTarget]);

  const imageSize = detail.state === "ok" && detail.imageSize ? detail.imageSize : usableSize(cutout.imageSize) ? cutout.imageSize : null;
  const originalUrl = detail.state === "ok" ? detail.originalUrl : null;
  // The frame from Adjust the area (the piece) or the whole picture (a change result).
  const box = cutout.box ?? wholeImageBox(imageSize);
  const request = box ? marksRequest(cutout.selectedIds, box, points) : null;
  const saved = sameMarks(points, cutout.points);
  const shown = showCut && saved && !!cutout.cleanedUrl;
  const piece = cutout.candidates.find((x) => x.id === cutout.selectedIds[0]) ?? null;
  const lead = shown ? (changed ? c.copy : c.copyOriginal) : c.adjustCopy;

  function say(text: string) { setAnnounce((a) => (a === text ? `${text} ` : text)); }
  function tell(text: string | null) { setNotice(text); if (text) say(text); }
  function addMark(p: CutoutPoint) {
    if (busy) return;
    if (points.length >= MAX_POINTS) { tell(t.maxMarks); return; }
    setPoints([...points, p]);
    setNotice(null);
    say(t.announceMark);
  }
  function removeMark(i: number) {
    if (busy) return;
    setPoints(points.filter((_, j) => j !== i));
    setNotice(null);
    say(t.announceUnmark);
  }
  function clearMarks() {
    if (busy) return;
    setPoints([]);
    setNotice(null);
    say(t.announceCleared);
  }
  function onTap(p: XY) { addMark({ x: Math.round(p.x), y: Math.round(p.y), label: mode === "remove" ? "negative" : "positive" }); }

  /** Saves the marked cut on the server; null when the call failed (the error is shown). */
  async function save(kind: Work): Promise<CutoutState | null> {
    if (!request) return null;
    const sent = request;
    try {
      const out = await applyMarks(flowDeps, cutout, sent);
      if (!live.current) return null;
      tell(out.notice);
      return out.cut;
    } catch (err) {
      if (!live.current) return null;
      setError(cleanupError(err, sent));
      setFailed(kind);
      focusOn("error");
      return null;
    }
  }

  /** "Apply cutout": the server keeps the new cut (and rebuilds products made from it). */
  async function apply() {
    if (!request || saved || inFlight.current) return;
    inFlight.current = true;
    setWork("apply");
    setError(null);
    setNotice(null);
    const cut = await save("apply");
    inFlight.current = false;
    if (!live.current) return;
    setWork(null);
    if (cut) { setShowCut(true); focusOn("result"); }
  }

  /** The candidate strip: another piece, cut with the frame (`cleanup {candidateIds:[id], box, clipToBox}`); marks start over. */
  async function pick(id: string) {
    if (!box || inFlight.current || cutout.selectedIds[0] === id) return;
    inFlight.current = true;
    setWork("apply");
    setError(null);
    setNotice(null);
    try {
      const out = await applyMarks(flowDeps, { ...cutout, selectedIds: [id] }, pickRequest(id, box));
      if (!live.current) return;
      setPoints([]);
      tell(out.notice);
      setShowCut(true);
      focusOn("result");
    } catch (err) {
      if (!live.current) return;
      setError(describeError(err));
      setFailed("apply");
      focusOn("error");
    } finally {
      inFlight.current = false;
      if (live.current) setWork(null);
    }
  }

  /** "Use this": the saved cut goes on (no second call); marks that were not applied yet are saved first. */
  async function goOn() {
    if (inFlight.current) return;
    if (saved) {
      if (cutout.cleanedUrl) takeCutout({ router, update: updateDraft, getDraft }, artworkId);
      return;
    }
    inFlight.current = true;
    setWork("use");
    setError(null);
    const cut = await save("use");
    inFlight.current = false;
    if (!live.current) return;
    setWork(null);
    if (cut) takeCutout({ router, update: updateDraft, getDraft }, artworkId);
  }

  function startOver() {
    resetDraft({ product: draft.product });
    router.push("/create/method");
  }

  return (
    <YourCutoutView
      uid={uid}
      title={c.title}
      lead={lead}
      back={yourCutoutBack(draft, artworkId)}
      work={work}
      announce={announce}
      cut={shown && cutout.cleanedUrl ? { src: cutout.cleanedUrl, alt: cutout.altText ?? t.cutoutAlt, aspectRatio: imageSize ? `${imageSize.w} / ${imageSize.h}` : undefined } : null}
      canShowCut={saved && !!cutout.cleanedUrl}
      photo={imageSize && originalUrl ? (
        <CutoutPhoto
          src={originalUrl} image={imageSize} frame={cutout.box} points={points}
          disabled={busy} onTap={onTap} onRemoveMark={removeMark} onImageError={onImageError}
        />
      ) : null}
      photoState={detail.state === "loading" ? "loading" : "missing"}
      modes={MODES}
      mode={mode}
      marks={points.map((pt, i) => fmt(pt.label === "positive" ? t.markAdded : t.markRemoved, { n: i + 1 }))}
      notice={notice}
      error={error}
      canUse={!!cutout.cleanedUrl || !!request}
      canApply={!!request && !saved}
      pieces={showsPieces(cutout) ? cutout.candidates.map((x) => ({ id: x.id, thumbUrl: x.thumbUrl })) : null}
      picked={cutout.selectedIds[0]}
      resultRef={resultRef}
      errorRef={errorRef}
      toolsRef={toolsRef}
      on={{
        pick: (id) => void pick(id),
        mode: setMode,
        addAround: () => { const pt = centrePoint(piece?.bbox ?? box); if (pt) addMark(pt); },
        removeMark,
        clearMarks,
        showCut: () => { setShowCut(true); focusOn("result"); },
        fixEdges: () => { setShowCut(false); focusOn("tools"); },
        use: () => void goOn(),
        apply: () => void apply(),
        retry: () => void (failed === "use" ? goOn() : apply()),
        startOver,
      }}
    />
  );
}
