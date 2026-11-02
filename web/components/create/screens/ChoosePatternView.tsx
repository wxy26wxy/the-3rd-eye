import type { ReactNode } from "react";
import { fmt, m } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/Icons";
import { Loading } from "@/components/ui/Loading";
import { NoticeCard } from "../cards";
import { CreateScreen } from "../CreateScreen";
import { percentRect, type ImageSize } from "../cutout";
import { ErrorNotice, type ScreenError } from "../errors";
import type { Candidate } from "../api";
import styles from "../Create.module.css";

const t = m.create.select;

export type ChoosePatternViewProps = {
  lead: string;
  retake: string;
  /** "Use this" is cutting the piece out. */
  busy: boolean;
  /** The photo with the pieces outlined (PatternPhoto), when the photo and its size are known. */
  photo: ReactNode | null;
  photoState: "loading" | "missing";
  candidates: { id: string; thumbUrl: string | null }[];
  picked: string | undefined;
  error: ScreenError | null;
  on: { pick: (id: string) => void; use: () => void };
};

/**
 * Choose a pattern (board `2027:3254`): title and copy, the photo on the green photo card, the
 * "Drawings found" strip (a radio group: one piece can be picked; 2 px ink border and the check
 * badge on the picked one), then Use this / Retake in the pinned bar. While the cut is made, Back
 * and the pieces are locked and only Use this shows (dimmed).
 */
export function ChoosePatternView({ on, ...p }: ChoosePatternViewProps) {
  const footer = p.busy ? (
    <Button block disabled aria-busy="true">{t.use}</Button>
  ) : (
    <>
      <Button block onClick={on.use} disabled={!p.picked}>{t.use}</Button>
      <Button block variant="secondary" arrow={false} href={p.retake}>{t.retake}</Button>
    </>
  );
  return (
    <CreateScreen back={p.busy ? undefined : p.retake} title={t.title} lead={p.lead} footer={footer}>
      {p.photo !== null ? (
        <div className={[styles.photoCard, p.busy ? styles.photoCardBusy : ""].filter(Boolean).join(" ")}>{p.photo}</div>
      ) : p.photoState === "loading" ? <Loading label={t.loadingPhoto} /> : <NoticeCard>{t.photoMissing}</NoticeCard>}
      <fieldset className={styles.fieldset} disabled={p.busy}>
        <legend className="visually-hidden">{t.groupLabel}</legend>
        <ul role="list" className={styles.pieces}>
          {p.candidates.map((c, i) => (
            <li key={c.id}>
              <label className={styles.piece}>
                <input className="visually-hidden" type="radio" name="pattern" value={c.id} checked={p.picked === c.id} onChange={() => on.pick(c.id)} />
                <span className={styles.pieceThumb}>
                  <ArtImage src={c.thumbUrl} alt="" placeholder={m.common.imageMissing} className={styles.pieceArt} />
                  <span className={styles.pieceCheck} aria-hidden="true"><CheckIcon /></span>
                </span>
                <span className={styles.pieceName}>{fmt(t.candidate, { n: i + 1 })}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {p.busy ? <Loading inline label={t.applying} /> : null}
      <ErrorNotice error={p.error} onRetry={on.use} retakeHref={p.busy ? undefined : p.retake} />
    </CreateScreen>
  );
}

/**
 * The photo with each piece outlined; the picked one solid with the check badge. A tap on an
 * outline picks that piece (pointer only: the radio strip under the photo is the keyboard and
 * screen-reader path, so the outlines are hidden from assistive tech).
 */
export function PatternPhoto({ src, image, candidates, picked, disabled, onPick, onImageError }: {
  src: string; image: ImageSize; candidates: Candidate[]; picked: string | undefined; disabled: boolean;
  onPick: (id: string) => void; onImageError?: () => void;
}) {
  return (
    <div className={styles.cutFrame}>
      <div className={styles.cutPhoto} style={{ aspectRatio: `${image.w} / ${image.h}` }} role="img" aria-label={t.photoLabel}>
        <div className={styles.cutStage} style={{ aspectRatio: `${image.w} / ${image.h}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className={styles.cutImg} draggable={false} onError={onImageError} />
          {candidates.map((c) => {
            const r = percentRect(c.bbox, image);
            if (!r) return null;
            const on = picked === c.id;
            return (
              <span key={c.id} aria-hidden="true" className={[styles.outline, on ? styles.outlineOn : "", styles.outlinePick].join(" ")}
                style={{ left: `${r.left}%`, top: `${r.top}%`, width: `${r.width}%`, height: `${r.height}%` }}
                onClick={() => { if (!disabled) onPick(c.id); }}>
                {on ? <span className={styles.outlineCheck}><CheckIcon /></span> : null}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
