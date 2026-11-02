"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { api, ApiError, type CleanupResult, type CutoutResult } from "../api";
import { HydratingScreen, MissingState } from "../CreateScreen";
import {
  boxAround, centrePoint, isStuck, leavesNothing, makeRequest, MAX_POINTS, needsTrimAdvice, productNotice, sameRequest, usableSize, wholeImageBox,
  type AppliedCutout, type Box, type CleanupRequest, type CutoutPoint, type XY,
} from "../cutout";
import { describeError, type ScreenError } from "../errors";
import { busyWhile } from "../flow";
import { currentChange, once, resetDraft, useCreate, type CutoutState } from "../store";
import { useOriginal } from "../useOriginal";
import { CutoutPhoto, type TapMode } from "./CutoutPhoto";
import { MakingCutoutView } from "./MakingCutoutView";
import { SelectView } from "./SelectView";

const t = m.create.select;
const c = m.create.cutout;
const MODES: { id: TapMode; label: string }[] = [
  { id: "add", label: t.modeAdd },
  { id: "remove", label: t.modeRemove },
  { id: "box", label: t.modeBox },
];
const NOTICE_COPY = { failed: t.failedProducts, unpublished: t.unpublishedProducts };

function cleanupError(err: unknown, sent: CleanupRequest | null): ScreenError {
  return needsTrimAdvice(err, sent) ? { message: t.instruction, action: "none" } : describeError(err);
}

/**
 * /create/cutout. For a change result without a cut-out yet: Making your cutout
 * (`POST /artworks/{id}/cutout`, SAM auto-picks the largest piece). Then Your cutout, with the edge
 * tools on "Fix the edges" (`POST /artworks/{id}/cleanup`, docs/api.md T080, unchanged).
 */
export function Cutout() {
  const { ready, draft } = useCreate();
  if (!ready) return <HydratingScreen title={c.title} />;
  const target = draft.cutoutArtworkId;
  if (!target || !draft.product) return <MissingState />;
  if (draft.cutout?.artworkId === target) return <YourCutoutFlow key={target} cutout={draft.cutout} />;
  return <MakingCutout key={target} artworkId={target} />;
}

function MakingCutout({ artworkId }: { artworkId: string }) {
  const { draft, update } = useCreate();
  const [error, setError] = useState<ScreenError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const step = draft.changes?.find((s) => s.artworkId === artworkId) ?? null;
  useEffect(() => {
    let live = true;
    once(`cutout:${artworkId}:${attempt}`, () => api<CutoutResult>(`artworks/${artworkId}/cutout`, { method: "POST", json: {} }))
      .then((res) => {
        if (!live) return;
        const first = res.candidates[0]?.id;
        update({
          cutout: { artworkId, candidates: res.candidates, imageSize: res.imageSize, selectedIds: first ? [first] : [], cleanedUrl: res.artwork.cleanedUrl, altText: res.artwork.altText },
          appliedCutout: undefined, cutoutNotice: undefined,
        });
      })
      .catch((err) => {
        if (!live) return;
        // Nothing found on the changed picture: open Fix the edges with no pieces (draw a box).
        if (err instanceof ApiError && err.code === "no_drawing_found") {
          update({ cutout: { artworkId, candidates: [], imageSize: null, selectedIds: [], cleanedUrl: null, altText: null }, appliedCutout: undefined });
          return;
        }
        setError(describeError(err));
      });
    return () => { live = false; };
  }, [artworkId, attempt, update]);
  return (
    <MakingCutoutView
      art={{ src: step?.previewUrl ?? null, alt: step?.alt ?? t.cutoutAlt }}
      changed={!!step}
      error={error}
      back={step ? "/create/compare" : "/create/change"}
      onRetry={() => { setError(null); setAttempt((a) => a + 1); }}
    />
  );
}

type Work = "apply" | "use";

function YourCutoutFlow({ cutout }: { cutout: CutoutState }) {
  const router = useRouter();
  const uid = useId();
  const { draft, update } = useCreate();
  const artworkId = cutout.artworkId;
  const candidates = cutout.candidates;
  const none = candidates.length === 0;
  /** Zero pieces on the photo (Draw a box from Take a photo): the box cut becomes the picked piece. */
  const rescue = !draft.pieceArtworkId;
  const changed = !!currentChange(draft) || artworkId !== draft.pieceArtworkId;
  // A cut saved by Apply comes back after a reload with the choice that made it; otherwise the cut-out
  // made by select / cutout is the saved one, with its pieces chosen.
  const [start] = useState(() => {
    const saved = draft.appliedCutout;
    const known = new Set(candidates.map((x) => x.id));
    if (saved && saved.artworkId === artworkId && (saved.request.candidateIds ?? []).every((id) => known.has(id))) {
      return { selectedIds: saved.request.candidateIds ?? [], points: saved.request.points ?? [], box: saved.request.box ?? null, applied: saved };
    }
    const request = makeRequest(cutout.selectedIds, [], null);
    const applied: AppliedCutout | null = cutout.cleanedUrl && request ? { artworkId, request, cleanedUrl: cutout.cleanedUrl, altText: cutout.altText } : null;
    return { selectedIds: cutout.selectedIds, points: [] as CutoutPoint[], box: null as Box | null, applied };
  });
  const [selectedIds, setSelectedIds] = useState<string[]>(start.selectedIds);
  const [points, setPoints] = useState<CutoutPoint[]>(start.points);
  const [box, setBox] = useState<Box | null>(start.box);
  const [mode, setMode] = useState<TapMode>(none ? "box" : "add");
  const [work, setWork] = useState<Work | null>(null);
  const [failed, setFailed] = useState<Work | null>(null);
  const [error, setError] = useState<ScreenError | null>(null);
  const [notice, setNotice] = useState<string | null>(draft.cutoutNotice ?? null);
  const [announce, setAnnounce] = useState("");
  const [applied, setAppliedState] = useState<AppliedCutout | null>(start.applied);
  const [showApplied, setShowApplied] = useState(!!start.applied);
  const setApplied = (request: CleanupRequest, art: CleanupResult) => {
    const saved: AppliedCutout = { artworkId, request, cleanedUrl: art.cleanedUrl, altText: art.altText };
    setAppliedState(saved);
    update({ appliedCutout: saved });
  };
  const { detail, onImageError } = useOriginal(artworkId);
  const retake = draft.method === "upload" ? "/create/photo?mode=upload" : "/create/photo?mode=camera";
  const busy = work !== null;
  const inFlight = useRef(false);
  const live = useRef(true);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [focusTarget, setFocus] = useState<{ to: "result" | "error"; n: number } | null>(null);
  const focusOn = (to: "result" | "error") => setFocus((f) => ({ to, n: (f?.n ?? 0) + 1 }));
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => {
    if (focusTarget?.to === "result") resultRef.current?.focus();
    if (focusTarget?.to === "error") errorRef.current?.focus();
  }, [focusTarget]);

  const imageSize = detail.state === "ok" && detail.imageSize ? detail.imageSize : usableSize(cutout.imageSize) ? cutout.imageSize : null;
  const originalUrl = detail.state === "ok" ? detail.originalUrl : null;
  const ordered = candidates.map((x) => x.id).filter((id) => selectedIds.includes(id));
  const selected = candidates.filter((x) => selectedIds.includes(x.id));
  const request = makeRequest(ordered, points, box);
  const appliedNow = applied && sameRequest(applied.request, request) ? applied : null;
  const shown = showApplied ? appliedNow : null;
  const modes = none ? MODES.filter((x) => x.id !== "remove") : MODES;
  const instruction = none && mode === "box" ? t.instructionBoxNone : t.instruction;
  const lead = shown ? (changed ? c.copy : c.copyOriginal) : none ? t.copyNone : c.adjustCopy;
  const wholeBox = none ? wholeImageBox(imageSize) : null;
  const stuck = isStuck(ordered, points, box);

  function say(text: string) { setAnnounce((a) => (a === text ? `${text} ` : text)); }
  function tell(text: string | null) { setNotice(text); if (text) say(text); }
  function sayAfter(text: string | null, next: { ids?: string[]; points?: CutoutPoint[]; box?: Box | null }) {
    const nowStuck = isStuck(next.ids ?? selectedIds, next.points ?? points, next.box === undefined ? box : next.box);
    const line = [text, nowStuck && !stuck ? t.needPiece : null].filter(Boolean).join(" ");
    if (line) say(line);
  }
  function toggle(id: string) {
    if (busy) return;
    const ids = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    setSelectedIds(ids);
    setNotice(null);
    sayAfter(null, { ids });
  }
  function addMark(p: CutoutPoint) {
    if (busy) return;
    if (points.length >= MAX_POINTS) { tell(t.maxMarks); return; }
    const next = [...points, p];
    if (p.label === "negative" && leavesNothing(selected, next, box)) { tell(t.instruction); return; }
    setPoints(next);
    setNotice(null);
    sayAfter(t.announceMark, { points: next });
  }
  function removeMark(i: number) {
    if (busy) return;
    const next = points.filter((_, j) => j !== i);
    setPoints(next);
    setNotice(null);
    sayAfter(t.announceUnmark, { points: next });
  }
  function placeBox(b: Box | null) {
    if (busy || !b) return;
    setBox(b);
    setNotice(null);
    say(t.announceBox);
  }
  function clearMarks() {
    if (busy) return;
    setPoints([]);
    setBox(null);
    setNotice(null);
    say(t.announceCleared);
  }
  function onTap(p: XY) { addMark({ x: p.x, y: p.y, label: mode === "remove" ? "negative" : "positive" }); }

  /** Saves the composed cut on the server; null when the call failed (the error is shown). */
  async function save(kind: Work): Promise<CleanupResult | null> {
    if (!request) return null;
    const sent = request;
    try {
      const art = await api<CleanupResult>(`artworks/${artworkId}/cleanup`, { json: sent });
      if (!live.current) return null;
      const pn = productNotice(art.details, NOTICE_COPY);
      setApplied(sent, art);
      update({ cutoutNotice: pn ?? undefined });
      tell(pn);
      return art;
    } catch (err) {
      if (!live.current) return null;
      setError(cleanupError(err, sent));
      setFailed(kind);
      focusOn("error");
      return null;
    }
  }

  /** "Apply cutout" is a save: the server keeps the cut (and rebuilds products made from it). */
  async function apply() {
    if (!request || inFlight.current) return;
    inFlight.current = true;
    setWork("apply");
    setError(null);
    setNotice(null);
    const art = await save("apply");
    if (art) { setShowApplied(true); focusOn("result"); }
    inFlight.current = false;
    if (live.current) setWork(null);
  }

  /** "Use this": the saved cut goes on (no second call), a changed choice is saved first. */
  async function goOn() {
    if (inFlight.current || (!appliedNow && !request)) return;
    inFlight.current = true;
    setError(null);
    // Cleared after navigating too: this route stays mounted, and coming back must not be locked.
    await busyWhile<Work | null>(setWork, "use", null, cutAndGoOn);
  }
  async function cutAndGoOn() {
    let cut = appliedNow;
    if (!cut) {
      const art = await save("use");
      cut = art && request ? { artworkId, request, cleanedUrl: art.cleanedUrl, altText: art.altText } : null;
    }
    inFlight.current = false;
    if (!live.current || !cut) return;
    const next: CutoutState = { ...cutout, selectedIds: ordered, cleanedUrl: cut.cleanedUrl, altText: cut.altText };
    if (rescue) {
      // The box cut is the picked piece now: on to Change it.
      update({ cutout: next, pieceArtworkId: artworkId, pieceCandidateId: undefined, pieceUrl: cut.cleanedUrl, pieceAlt: cut.altText, pieceSpoken: undefined });
      router.push("/create/change");
      return;
    }
    update({ cutout: next, artworkId, productRecord: undefined });
    router.push("/create/making");
  }

  function startOver() {
    resetDraft({ product: draft.product });
    router.push("/create/method");
  }

  return (
    <SelectView
      uid={uid}
      title={c.title}
      lead={lead}
      back={rescue ? retake : changed ? "/create/compare" : "/create/change"}
      retake={retake}
      work={work}
      announce={announce}
      photo={imageSize && originalUrl ? (
        <CutoutPhoto
          src={originalUrl} image={imageSize} candidates={candidates} selectedIds={selectedIds} points={points} box={box}
          mode={mode} disabled={busy} onTap={onTap} onBox={placeBox} onRemoveMark={removeMark} onToggle={toggle} onImageError={onImageError}
        />
      ) : null}
      photoState={detail.state === "loading" ? "loading" : "missing"}
      noPieces={none}
      applied={shown ? { src: shown.cleanedUrl ?? "", alt: shown.altText ?? t.cutoutAlt, aspectRatio: imageSize ? `${imageSize.w} / ${imageSize.h}` : undefined } : null}
      canShowApplied={!!appliedNow}
      candidates={candidates.map((x) => ({ id: x.id, thumbUrl: x.thumbUrl }))}
      selectedIds={selectedIds}
      modes={modes}
      mode={mode}
      instruction={instruction}
      keyboardHint={none ? t.keyboardHintNone : t.keyboardHint}
      wholePhoto={!!wholeBox}
      marks={points.map((pt, i) => fmt(pt.label === "positive" ? t.markAdded : t.markRemoved, { n: i + 1 }))}
      hasMarksOrBox={points.length > 0 || box !== null}
      notice={notice}
      stuck={stuck}
      error={error}
      canUse={!!appliedNow || !!request}
      canApply={!!request}
      resultRef={resultRef}
      errorRef={errorRef}
      on={{
        toggle,
        boxAround: (i) => { const x = candidates[i]; if (x) placeBox(boxAround(x)); },
        addAround: (i) => { const x = candidates[i]; const pt = x ? centrePoint(x) : null; if (pt) addMark(pt); },
        mode: setMode,
        wholePhoto: () => placeBox(wholeBox),
        removeMark,
        clearMarks,
        toggleApplied: () => setShowApplied((v) => !v),
        use: () => void goOn(),
        apply: () => void apply(),
        retry: () => void (failed === "use" ? goOn() : apply()),
        startOver,
      }}
    />
  );
}
