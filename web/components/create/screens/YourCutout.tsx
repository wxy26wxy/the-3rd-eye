"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { upload } from "@vercel/blob/client";
import { api, HANDLE_UPLOAD_URL, UPLOAD_ACCESS, uuid } from "../api";
import { HydratingScreen, MissingState } from "../CreateScreen";
import { cropToFrame } from "../crop";
import {
  centrePoint, marksRequest, MAX_POINTS, needsTrimAdvice, sameMarks, usableSize, wholeImageBox,
  type CleanupRequest, type CutoutPoint, type XY,
} from "../cutout";
import { describeError, type ScreenError } from "../errors";
import {
  applyMarks, areaNotFound, cutIsChange, cutoutNewPhoto, cutoutVisit, makingCutoutBack, photoGone, PhotoGoneError, pickRequest, runAreaCut,
  showsPieces, takeCutout, yourCutoutBack, type CropUpload,
} from "../flow";
import { cutoutOf, getCreator, getDraft, once, resetDraft, updateDraft, useCreate, useCreator, type CutoutState, type Draft } from "../store";
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
 * /create/cutout. Making your cutout runs the crop the draft is waiting for (round 4: crop on the
 * device → upload → `POST /artworks {framed: true}`; a change result is cut on Changing). Then Your
 * cutout: the cut, with Add area / Remove area marks (in pixels of the working picture) and Apply
 * cutout on "Fix the edges"; "Use this" goes to Change it.
 */
export function Cutout() {
  const { ready, draft } = useCreate();
  if (!ready) return <HydratingScreen title={c.title} />;
  const visit = draft.product ? cutoutVisit(draft) : "missing";
  const target = draft.cutoutArtworkId as string;
  if (visit === "cut") return <YourCutoutFlow key={target} cutout={cutoutOf(draft, target) as CutoutState} />;
  if (visit === "area") return <MakingArea key={draft.pendingArea?.nonce} job={draft.pendingArea as NonNullable<Draft["pendingArea"]>} />;
  return <MissingState />;
}

/**
 * The crop upload (round 4 ruling 1): the local photo cropped to the frame on a canvas (orientation
 * applied, JPEG), then the Blob client upload, as the photo upload was before. Only the crop leaves
 * the device.
 */
function cropUploader(creatorId: () => Promise<string>): CropUpload {
  return async (file, box) => {
    const { blob } = await cropToFrame(file, box);
    const id = await creatorId();
    const res = await upload(`creators/${id}/photo/${uuid()}.jpg`, blob, { access: UPLOAD_ACCESS, handleUploadUrl: HANDLE_UPLOAD_URL, contentType: "image/jpeg" });
    return res.url;
  };
}

/**
 * Making your cutout for "Use this area" (crop → upload → `POST /artworks`, the searching
 * magnifier); a crop with nothing in it goes back to Adjust the area, which says to move or grow the
 * frame; a lost local photo (a reload) goes to the photo step.
 */
function MakingArea({ job }: { job: NonNullable<Draft["pendingArea"]> }) {
  const router = useRouter();
  const { refresh } = useCreator();
  const [error, setError] = useState<ScreenError | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    const upload = cropUploader(async () => (getCreator() ?? (await refresh()))?.id ?? "me");
    // The draft is updated even after a navigation away; only a result for this frame counts.
    once(`area:${job.nonce}:${attempt}`, () => runAreaCut({ ...flowDeps, upload }, job)).catch((err) => {
      if (err instanceof PhotoGoneError) { if (getDraft().pendingArea?.nonce === job.nonce) photoGone({ router, update: updateDraft }, getDraft()); return; }
      if (isNotFound(err)) { areaNotFound({ ...flowDeps, router }, job); return; }
      if (live) setError(areaError(err));
    });
    return () => { live = false; };
  }, [job, attempt, router, refresh]);
  return (
    <MakingCutoutView
      changed={false}
      error={error}
      back={makingCutoutBack()}
      onRetry={() => { setError(null); setAttempt((a) => a + 1); }}
    />
  );
}

type Work = "apply" | "use" | "pick";

/** What Try again repeats: Use this, the failed piece from the strip (review I4), else Apply cutout. */
export function retryOf(failed: Work | null, failedPick: string | null): { kind: "use" } | { kind: "pick"; id: string } | { kind: "apply" } {
  if (failed === "use") return { kind: "use" };
  if (failed === "pick" && failedPick) return { kind: "pick", id: failedPick };
  return { kind: "apply" };
}

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
  /** The piece whose re-cut failed, for Try again. */
  const failedPick = useRef<string | null>(null);
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
  // The whole working picture (round 4: the piece's picture is the crop of the frame).
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
    failedPick.current = null;
    setWork("pick");
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
      // Try again repeats this pick (review I4), not Apply cutout.
      failedPick.current = id;
      setFailed("pick");
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
      newPhoto={cutoutNewPhoto(draft, artworkId)}
      work={work}
      announce={announce}
      cut={shown && cutout.cleanedUrl ? { src: cutout.cleanedUrl, alt: cutout.altText ?? t.cutoutAlt, aspectRatio: imageSize ? `${imageSize.w} / ${imageSize.h}` : undefined } : null}
      canShowCut={saved && !!cutout.cleanedUrl}
      photo={imageSize && originalUrl ? (
        <CutoutPhoto
          src={originalUrl} image={imageSize} points={points}
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
        retry: () => {
          const r = retryOf(failed, failedPick.current);
          void (r.kind === "use" ? goOn() : r.kind === "pick" ? pick(r.id) : apply());
        },
        startOver,
      }}
    />
  );
}
