"use client";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button } from "@/components/ui/Button";
import { CameraIcon } from "@/components/ui/Icons";
import { Loading, Status } from "@/components/ui/Loading";
import { api, ApiError, type Artwork, type ArtworkDetail, type CleanupResult } from "../api";
import { CreateScreen, HydratingScreen, MissingState } from "../CreateScreen";
import {
  boxAround, centrePoint, chooseAction, leavesNothing, makeRequest, MAX_POINTS, productNotice, sameRequest, usableSize,
  type Box, type CleanupRequest, type CutoutPoint, type ImageSize, type XY,
} from "../cutout";
import { describeError, ErrorNotice, type ScreenError } from "../errors";
import { makeProduct, once, useCreate } from "../store";
import { CutoutPhoto, type TapMode } from "./CutoutPhoto";
import styles from "../Create.module.css";

const t = m.create.select;
const MODES: { id: TapMode; label: string; instruction: string }[] = [
  { id: "add", label: t.modeAdd, instruction: t.instructionAdd },
  { id: "remove", label: t.modeRemove, instruction: t.instructionRemove },
  { id: "box", label: t.modeBox, instruction: t.instructionBox },
];
const NOTICE_COPY = { failed: t.failedProducts, unpublished: t.unpublishedProducts };

/** A 422 means "nothing left to cut"; when Remove-area marks were sent, say how to trim instead. */
function cleanupError(err: unknown, sent: CleanupRequest | null): ScreenError {
  if (err instanceof ApiError && err.status === 422 && sent?.points?.some((p) => p.label === "negative")) {
    return { message: t.instructionRemove, action: "none" };
  }
  return describeError(err);
}

/**
 * SAM found pieces in the photo. The creator picks one or several (combined), adds areas or
 * leaves pieces out with taps, or draws a box; "Apply cutout" saves the cut on the server and
 * shows it; "Use this" goes on to make the product. Same API and rules as the iOS Adjust cutout
 * screen (docs/api.md T080).
 */
export function Select() {
  const { ready, draft } = useCreate();
  if (!ready) return <HydratingScreen title={t.title} />;
  if (!draft.photoArtworkId || !draft.candidates?.length || !draft.product) return <MissingState />;
  return <SelectFlow key={draft.photoArtworkId} />;
}

type Detail = { state: "loading" } | { state: "failed" } | { state: "ok"; originalUrl: string | null; imageSize: ImageSize | null };
type Work = "apply" | "use";

function SelectFlow() {
  const router = useRouter();
  const uid = useId();
  const { draft, update } = useCreate();
  const artworkId = draft.photoArtworkId as string;
  const candidates = draft.candidates ?? [];
  const [selectedIds, setSelectedIds] = useState<string[]>(() => (candidates[0] ? [candidates[0].id] : []));
  const [points, setPoints] = useState<CutoutPoint[]>([]);
  const [box, setBox] = useState<Box | null>(null);
  const [mode, setMode] = useState<TapMode>("add");
  const [work, setWork] = useState<Work | null>(null);
  const [failed, setFailed] = useState<Work | null>(null);
  const [error, setError] = useState<ScreenError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [applied, setApplied] = useState<{ request: CleanupRequest; artwork: CleanupResult } | null>(null);
  const [showApplied, setShowApplied] = useState(false);
  const [detail, setDetail] = useState<Detail>({ state: "loading" });
  const retake = draft.method === "upload" ? "/create/photo?mode=upload" : "/create/photo?mode=camera";
  const busy = work !== null;

  // The original (presigned, short-lived) and its size come from GET /artworks/{id}.
  useEffect(() => {
    let live = true;
    once(`detail:${artworkId}`, () => api<ArtworkDetail>(`artworks/${artworkId}`))
      .then((d) => { if (live) setDetail({ state: "ok", originalUrl: d.originalUrl, imageSize: usableSize(d.imageSize) ? d.imageSize : null }); })
      .catch(() => { if (live) setDetail({ state: "failed" }); });
    return () => { live = false; };
  }, [artworkId]);

  const imageSize = detail.state === "ok" && detail.imageSize ? detail.imageSize : usableSize(draft.imageSize) ? draft.imageSize : null;
  const originalUrl = detail.state === "ok" ? detail.originalUrl : null;
  const ordered = candidates.map((c) => c.id).filter((id) => selectedIds.includes(id));
  const selected = candidates.filter((c) => selectedIds.includes(c.id));
  const request = makeRequest(ordered, points, box);
  const action = chooseAction(ordered, points, box);
  const appliedNow = applied && sameRequest(applied.request, request) ? applied : null;
  const shown = showApplied ? appliedNow : null;
  const instruction = MODES.find((x) => x.id === mode)?.instruction ?? "";
  const lead = candidates.length === 1 ? t.copyOne : fmt(t.copyMany, { n: candidates.length });

  function say(text: string) { setAnnounce((a) => (a === text ? `${text} ` : text)); }

  function toggle(id: string) {
    if (busy) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setNotice(null);
  }
  function addMark(p: CutoutPoint) {
    if (busy) return;
    if (points.length >= MAX_POINTS) { setNotice(t.maxMarks); return; }
    const next = [...points, p];
    // A Remove-area mark that would drop every chosen piece leaves nothing to cut: refuse it.
    if (p.label === "negative" && leavesNothing(selected, next, box)) { setNotice(t.instructionRemove); return; }
    setPoints(next);
    setNotice(null);
    say(t.announceMark);
  }
  function removeMark(i: number) {
    if (busy) return;
    setPoints((prev) => prev.filter((_, j) => j !== i));
    setNotice(null);
    say(t.announceUnmark);
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

  /** "Apply cutout" is a save: the server keeps the cut (and rebuilds products made from it). */
  async function apply() {
    if (!request || busy) return;
    const sent = request;
    setWork("apply");
    setError(null);
    setNotice(null);
    try {
      const art = await api<CleanupResult>(`artworks/${artworkId}/cleanup`, { json: sent });
      const pn = productNotice(art.details, NOTICE_COPY);
      setApplied({ request: sent, artwork: art });
      setShowApplied(true);
      setNotice(pn);
      update({ cutoutNotice: pn ?? undefined });
      say(t.applied);
    } catch (err) {
      setError(cleanupError(err, sent));
      setFailed("apply");
    } finally {
      setWork(null);
    }
  }

  async function goOn() {
    if (!action || busy || !draft.product) return;
    setWork("use");
    setError(null);
    try {
      let id = artworkId;
      // Already saved by "Apply cutout" with the same choice: no second call.
      if (!appliedNow) {
        if (action.kind === "select") {
          id = (await api<Artwork>(`artworks/${artworkId}/select`, { json: { candidateId: action.candidateId } })).id;
          update({ cutoutNotice: undefined });
        } else {
          const art = await api<CleanupResult>(`artworks/${artworkId}/cleanup`, { json: action.body });
          id = art.id;
          update({ cutoutNotice: productNotice(art.details, NOTICE_COPY) ?? undefined });
        }
      }
      await makeProduct(id, draft.product);
      router.push("/create/ready");
    } catch (err) {
      setError(cleanupError(err, action.kind === "cleanup" ? action.body : null));
      setFailed("use");
      setWork(null);
    }
  }

  const productWord = draft.product === "tote" ? m.common.tote.toLowerCase() : m.common.sticker.toLowerCase();
  const photoReady = !!(imageSize && originalUrl);
  return (
    <CreateScreen
      back={retake}
      step={3}
      title={t.title}
      lead={lead}
      footer={work === "use" ? null : (
        <>
          <Button block onClick={() => void goOn()} disabled={!action || busy}>{t.use}</Button>
          <Button block variant="secondary" arrow={false} onClick={() => void apply()} disabled={!request || busy} aria-busy={work === "apply"}>
            {work === "apply" ? t.applying : t.apply}
          </Button>
          <Button block variant="secondary" arrow={false} icon={<CameraIcon />} href={retake}>{t.retake}</Button>
        </>
      )}
    >
      <p className="visually-hidden" role="status">{announce}</p>
      {work === "use" ? <Loading label={fmt(m.create.result.making, { product: productWord })} /> : null}
      {work === "apply" ? <Loading label={t.applying} /> : null}

      {shown ? (
        <div className={styles.checker} style={imageSize ? { aspectRatio: `${imageSize.w} / ${imageSize.h}` } : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown.artwork.cleanedUrl ?? ""} alt={shown.artwork.altText ?? t.cutoutAlt} />
        </div>
      ) : imageSize && originalUrl ? (
        <CutoutPhoto
          src={originalUrl} image={imageSize} candidates={candidates} selectedIds={selectedIds} points={points} box={box}
          mode={mode} disabled={busy} onTap={onTap} onBox={placeBox} onRemoveMark={removeMark}
        />
      ) : detail.state === "loading" ? <Loading label={t.loadingPhoto} /> : <Status>{t.photoMissing}</Status>}

      {appliedNow ? (
        <Button block variant="secondary" arrow={false} onClick={() => setShowApplied((v) => !v)} disabled={busy}>
          {shown ? t.backToPhoto : t.showCutout}
        </Button>
      ) : null}

      {photoReady && !shown ? (
        <>
          <fieldset className={styles.modes} disabled={busy}>
            <legend className="visually-hidden">{t.modesLabel}</legend>
            {MODES.map((x) => (
              <label key={x.id} className={styles.mode}>
                <input type="radio" name={`${uid}-mode`} value={x.id} checked={mode === x.id} onChange={() => setMode(x.id)} />
                <span>{x.label}</span>
              </label>
            ))}
          </fieldset>
          <p className={styles.instruction}>{instruction} {t.keyboardHint}</p>
        </>
      ) : null}

      {points.length || box ? <button type="button" className={styles.textButton} onClick={clearMarks} disabled={busy}>{t.clearMarks}</button> : null}
      {notice ? <Status>{notice}</Status> : null}
      <ErrorNotice error={error} onRetry={() => void (failed === "use" ? goOn() : apply())} retakeHref={retake} />

      <fieldset className={styles.fieldset} disabled={busy}>
        <legend className="visually-hidden">{t.groupLabel}</legend>
        <ul role="list" className={styles.variants}>
          {candidates.map((c, i) => {
            const labelId = `${uid}-piece-${i}`;
            return (
              <li key={c.id} className={styles.variant}>
                <label className={styles.pick}>
                  <input type="checkbox" value={c.id} checked={selectedIds.includes(c.id)} onChange={() => toggle(c.id)} />
                  <ArtImage src={c.thumbUrl} alt="" placeholder={m.common.imageMissing} />
                  <span className={styles.pickLabel} id={labelId}>
                    {fmt(t.candidate, { n: i + 1 })}<span className={[styles.tick, styles.tickBox].join(" ")} aria-hidden="true" />
                  </span>
                </label>
                <div role="group" aria-labelledby={labelId} className={styles.pieceActions}>
                  <button type="button" className={styles.pieceAction} onClick={() => placeBox(boxAround(c))}>{t.boxAround}</button>
                  <button type="button" className={styles.pieceAction} onClick={() => { const p = centrePoint(c); if (p) addMark(p); }}>{t.addAround}</button>
                </div>
              </li>
            );
          })}
        </ul>
      </fieldset>
    </CreateScreen>
  );
}
