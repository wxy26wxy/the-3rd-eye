import type { ReactNode, Ref } from "react";
import { fmt, m } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button } from "@/components/ui/Button";
import { BoxIcon, CheckIcon, CloseIcon, MinusIcon, PlusIcon } from "@/components/ui/Icons";
import { Loading } from "@/components/ui/Loading";
import { ErrorCard, NoticeCard } from "../cards";
import { CreateScreen } from "../CreateScreen";
import { ErrorNotice, type ScreenError } from "../errors";
import type { TapMode } from "./CutoutPhoto";
import styles from "../Create.module.css";

const t = m.create.select;
const MODE_ICON: Record<TapMode, ReactNode> = { add: <PlusIcon />, remove: <MinusIcon />, box: <BoxIcon /> };

export type SelectViewProps = {
  /** Prefix for ids inside the view (useId of the screen). */
  uid: string;
  lead: string;
  retake: string;
  /** "sticker" / "tote bag", for "Making your …". */
  productWord: string;
  /** The request in flight: Apply cutout ("apply") or Use this ("use"). */
  work: "apply" | "use" | null;
  /** Text for the one permanent polite live region. */
  announce: string;
  /** The interactive photo (CutoutPhoto), when the photo and its size are known. */
  photo: ReactNode | null;
  /** Without `photo`: still loading, or could not be shown. */
  photoState: "loading" | "missing";
  noPieces: boolean;
  /** The saved cut, when it is the one on screen ("Show the cutout" on). */
  applied: { src: string; alt: string; aspectRatio?: string } | null;
  /** A saved cut matches the current choice, so the view can switch between it and the photo. */
  canShowApplied: boolean;
  candidates: { id: string; thumbUrl: string | null }[];
  selectedIds: string[];
  modes: { id: TapMode; label: string }[];
  mode: TapMode;
  instruction: string;
  keyboardHint: string;
  /** Zero pieces: offer "Use the whole photo" (keyboard path to a box). */
  wholePhoto: boolean;
  /** Accessible names of the marks, in order ("Added area, mark 1. Remove this mark"). */
  marks: string[];
  hasMarksOrBox: boolean;
  notice: string | null;
  /** Only marks that cannot be sent are left: "Pick a piece…" (Apply / Use this stay off). */
  stuck: boolean;
  error: ScreenError | null;
  canUse: boolean;
  canApply: boolean;
  resultRef?: Ref<HTMLHeadingElement>;
  errorRef?: Ref<HTMLDivElement>;
  on: {
    toggle: (id: string) => void;
    boxAround: (index: number) => void;
    addAround: (index: number) => void;
    mode: (mode: TapMode) => void;
    wholePhoto: () => void;
    removeMark: (index: number) => void;
    clearMarks: () => void;
    toggleApplied: () => void;
    use: () => void;
    apply: () => void;
    retry: () => void;
  };
};

/**
 * Pick your art (boards `2027:3254` select, `2038:4092` marks, `2038:4233` applied, `2038:4369` saving).
 * Order follows the board: the photo on the green photo card, the piece strip (checkboxes), per-piece
 * "Box around this piece" / "Add the area around this piece", the tool picker, the instruction and
 * keyboard hint, the marks list, notices and errors, Clear marks; Use this / Apply cutout / Retake in
 * the bar. While a request runs, Back and every control are locked and only Use this shows (dimmed).
 */
export function SelectView({ resultRef, errorRef, on, ...p }: SelectViewProps) {
  const busy = p.work !== null;
  const showing = p.applied !== null;
  const footer = busy ? (
    <Button block disabled aria-busy={p.work === "use"}>{t.use}</Button>
  ) : (
    <>
      <Button block onClick={on.use} disabled={!p.canUse}>{t.use}</Button>
      {showing ? null : <Button block variant="secondary" arrow={false} onClick={on.apply} disabled={!p.canApply}>{t.apply}</Button>}
      <Button block variant="secondary" arrow={false} href={p.retake}>{t.retake}</Button>
    </>
  );
  const tools = p.photo !== null && !showing;

  return (
    <CreateScreen back={busy ? undefined : p.retake} step={3} title={t.title} lead={p.lead} footer={footer}>
      <p className="visually-hidden" role="status" aria-live="polite">{p.announce}</p>

      {showing && p.applied ? (
        <>
          <div className={styles.checker} style={p.applied.aspectRatio ? { aspectRatio: p.applied.aspectRatio } : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.applied.src} alt={p.applied.alt} />
          </div>
          <h2 ref={resultRef} tabIndex={-1} className={styles.resultHeading}>{t.applied}</h2>
        </>
      ) : p.photo !== null ? (
        <div className={[styles.photoCard, busy ? styles.photoCardBusy : ""].filter(Boolean).join(" ")}>{p.photo}</div>
      ) : p.photoState === "loading" ? <Loading label={t.loadingPhoto} /> : <NoticeCard>{p.noPieces ? t.photoMissingNone : t.photoMissing}</NoticeCard>}

      {busy ? <Loading inline label={p.work === "apply" ? t.applying : fmt(m.create.result.making, { product: p.productWord })} /> : null}

      {!busy && p.canShowApplied ? (
        <Button block variant="secondary" arrow={false} onClick={on.toggleApplied}>{showing ? t.backToPhoto : t.showCutout}</Button>
      ) : null}

      {!busy && !showing && !p.noPieces ? (
        <>
          <fieldset className={styles.fieldset}>
            <legend className="visually-hidden">{t.groupLabel}</legend>
            <ul role="list" className={styles.pieces}>
              {p.candidates.map((c, i) => (
                <li key={c.id}>
                  <label className={styles.piece}>
                    <input className="visually-hidden" type="checkbox" value={c.id} checked={p.selectedIds.includes(c.id)} onChange={() => on.toggle(c.id)} />
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
          <div className={styles.pieceGroups}>
            {p.candidates.map((c, i) => {
              const labelId = `${p.uid}-piece-${i}`;
              return (
                <div key={c.id} role="group" aria-labelledby={labelId} className={styles.pieceActions}>
                  <p id={labelId} className={styles.pieceGroupName}>{fmt(t.candidate, { n: i + 1 })}</p>
                  <button type="button" className={styles.pieceAction} onClick={() => on.boxAround(i)}>{t.boxAround}</button>
                  <button type="button" className={styles.pieceAction} onClick={() => on.addAround(i)}>{t.addAround}</button>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {tools && !busy ? (
        <>
          <fieldset className={styles.modes}>
            <legend className="visually-hidden">{t.modesLabel}</legend>
            {p.modes.map((x) => (
              <label key={x.id} className={styles.mode}>
                <input className="visually-hidden" type="radio" name={`${p.uid}-mode`} value={x.id} checked={p.mode === x.id} onChange={() => on.mode(x.id)} />
                <span className={styles.modeIcon} aria-hidden="true">{MODE_ICON[x.id]}</span>
                <span>{x.label}</span>
              </label>
            ))}
          </fieldset>
          <p className={styles.instruction}>{p.instruction}</p>
          <p className={styles.keyboardHint}>{p.keyboardHint}</p>
          {p.wholePhoto ? <button type="button" className={styles.pieceAction} onClick={on.wholePhoto}>{t.wholePhoto}</button> : null}
        </>
      ) : null}

      {!busy && !showing && p.marks.length ? (
        <div className={styles.marks}>
          <p className={styles.marksLabel} id={`${p.uid}-marks`}>{t.marksLabel}</p>
          <ul role="list" aria-labelledby={`${p.uid}-marks`} className={styles.marksList}>
            {p.marks.map((label, i) => (
              <li key={`${i}-${label}`}>
                <button type="button" className={styles.markRow} onClick={() => on.removeMark(i)}>
                  <span aria-hidden="true" className={styles.markRowIcon}><CloseIcon /></span>{label}
                </button>
              </li>
            ))}
          </ul>
          {p.notice === t.maxMarks ? null : <p className={styles.marksNote}>{t.maxMarks}</p>}
        </div>
      ) : null}

      {p.notice ? <NoticeCard>{p.notice}</NoticeCard> : null}
      {p.stuck && !busy ? <ErrorCard live="off">{t.needPiece}</ErrorCard> : null}
      <div ref={errorRef} tabIndex={-1} className={styles.errorSpot}>
        <ErrorNotice error={p.error} onRetry={on.retry} retakeHref={busy ? undefined : p.retake} />
      </div>

      {!busy && !showing && p.hasMarksOrBox ? (
        <Button variant="ghost" arrow={false} className={styles.textAction} onClick={on.clearMarks}>{t.clearMarks}</Button>
      ) : null}
    </CreateScreen>
  );
}
