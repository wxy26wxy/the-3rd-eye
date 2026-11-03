import type { ReactNode, Ref } from "react";
import { Button } from "@/components/ui/Button";
import { ArtImage } from "@/components/ui/ArtImage";
import { CheckIcon, CloseIcon, MinusIcon, PlusIcon } from "@/components/ui/Icons";
import { fmt, m } from "@/components/messages";
import { Loading } from "@/components/ui/Loading";
import { NoticeCard } from "../cards";
import { CreateScreen } from "../CreateScreen";
import { ErrorNotice, type ScreenError } from "../errors";
import type { TapMode } from "./CutoutPhoto";
import styles from "../Create.module.css";

const t = m.create.select;
const MODE_ICON: Record<TapMode, ReactNode> = { add: <PlusIcon />, remove: <MinusIcon /> };

export type YourCutoutViewProps = {
  /** Prefix for ids inside the view (useId of the screen). */
  uid: string;
  title: string;
  lead: string;
  /** Back target (hidden while a request runs). */
  back: string;
  /** The request in flight: Apply cutout ("apply") or Use this ("use"). */
  work: "apply" | "use" | null;
  /** Text for the one permanent polite live region. */
  announce: string;
  /** The saved cut on the checkerboard, when it is on screen (null: "Fix the edges" is open). */
  cut: { src: string; alt: string; aspectRatio?: string } | null;
  /** A saved cut matches the marks, so "Show the cutout" can switch back to it. */
  canShowCut: boolean;
  /** The picture with the frame and the marks (CutoutPhoto), when it and its size are known. */
  photo: ReactNode | null;
  /** Without `photo`: still loading, or could not be shown. */
  photoState: "loading" | "missing";
  modes: { id: TapMode; label: string }[];
  mode: TapMode;
  /** Accessible names of the marks, in order ("Added area, mark 1. Remove this mark"). */
  marks: string[];
  /** Product trouble reported by the last cleanup, or the 10-mark limit. */
  notice: string | null;
  error: ScreenError | null;
  canUse: boolean;
  canApply: boolean;
  /**
   * The candidate strip (round 3): the pieces `detect` found inside the frame, only when there are
   * two or more; `picked` is the one in the cut.
   */
  pieces?: { id: string; thumbUrl: string }[] | null;
  picked?: string;
  resultRef?: Ref<HTMLHeadingElement>;
  errorRef?: Ref<HTMLDivElement>;
  /** The Add area / Remove area picker, focused when Fix the edges opens. */
  toolsRef?: Ref<HTMLFieldSetElement>;
  on: {
    /** Picks another piece from the strip (re-cut with the frame). */
    pick?: (id: string) => void;
    mode: (mode: TapMode) => void;
    addAround: () => void;
    removeMark: (index: number) => void;
    clearMarks: () => void;
    showCut: () => void;
    fixEdges: () => void;
    use: () => void;
    apply: () => void;
    retry: () => void;
    startOver: () => void;
  };
};

/**
 * Your cutout (board `2038:4233` the cut, `2038:4092` Fix the edges; T130 restores the tools). The
 * cut: the checkerboard cut-out, "Your cutout is ready", Fix the edges, the product notice; Use this
 * / Start over in the bar. Fix the edges: the picture on the green photo card with the frame and the
 * marks, the Add area / Remove area picker, the instruction and keyboard hint, "Add the area around
 * your art" (the keyboard and screen-reader path), the Marks list, notices and errors, Clear marks;
 * Use this / Apply cutout / Start over in the bar. No "Draw a box": the frame from Adjust the area is
 * the box. While a request runs, Back and every control are locked and only Use this shows (dimmed).
 */
export function YourCutoutView({ resultRef, errorRef, toolsRef, on, ...p }: YourCutoutViewProps) {
  const busy = p.work !== null;
  const showing = p.cut !== null;
  const footer = busy ? (
    <Button block disabled aria-busy={p.work === "use"}>{t.use}</Button>
  ) : (
    <>
      <Button block onClick={on.use} disabled={!p.canUse}>{t.use}</Button>
      {showing ? null : <Button block variant="secondary" arrow={false} onClick={on.apply} disabled={!p.canApply}>{t.apply}</Button>}
      <Button block variant="secondary" arrow={false} onClick={on.startOver}>{m.common.startOver}</Button>
    </>
  );
  const tools = p.photo !== null && !showing && !busy;

  return (
    <CreateScreen back={busy ? undefined : p.back} title={p.title} lead={p.lead} footer={footer}>
      <p className="visually-hidden" role="status" aria-live="polite">{p.announce}</p>

      {showing && p.cut ? (
        <>
          <div className={styles.checker} style={p.cut.aspectRatio ? { aspectRatio: p.cut.aspectRatio } : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.cut.src} alt={p.cut.alt} />
          </div>
          <h2 ref={resultRef} tabIndex={-1} className={styles.resultHeading}>{t.applied}</h2>
          <Button block variant="secondary" arrow={false} onClick={on.fixEdges}>{t.backToPhoto}</Button>
        </>
      ) : p.photo !== null ? (
        <div className={[styles.photoCard, busy ? styles.photoCardBusy : ""].filter(Boolean).join(" ")}>{p.photo}</div>
      ) : p.photoState === "loading" ? <Loading label={t.loadingPhoto} /> : <NoticeCard>{t.photoMissingNone}</NoticeCard>}

      {busy ? <Loading inline label={t.applying} /> : null}

      {!busy && p.pieces && p.pieces.length >= 2 ? (
        <fieldset className={styles.fieldset}>
          <legend className={styles.marksLabel}>{t.groupLabel}</legend>
          <ul role="list" className={styles.pieces}>
            {p.pieces.map((c, i) => (
              <li key={c.id}>
                <label className={styles.piece}>
                  <input className="visually-hidden" type="radio" name={`${p.uid}-piece`} value={c.id} checked={p.picked === c.id} onChange={() => on.pick?.(c.id)} />
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
      ) : null}

      {!busy && !showing && p.canShowCut ? (
        <Button block variant="secondary" arrow={false} onClick={on.showCut}>{t.showCutout}</Button>
      ) : null}

      {tools ? (
        <>
          <fieldset ref={toolsRef} className={styles.modes}>
            <legend className="visually-hidden">{t.modesLabel}</legend>
            {p.modes.map((x) => (
              <label key={x.id} className={styles.mode}>
                <input className="visually-hidden" type="radio" name={`${p.uid}-mode`} value={x.id} checked={p.mode === x.id} onChange={() => on.mode(x.id)} />
                <span className={styles.modeIcon} aria-hidden="true">{MODE_ICON[x.id]}</span>
                <span>{x.label}</span>
              </label>
            ))}
          </fieldset>
          <p className={styles.instruction}>{t.instruction}</p>
          <p className={styles.keyboardHint}>{t.keyboardHint}</p>
          <button type="button" className={styles.pieceAction} onClick={on.addAround}>{t.addAround}</button>
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
      <div ref={errorRef} tabIndex={-1} className={styles.errorSpot}>
        <ErrorNotice error={p.error} onRetry={on.retry} />
      </div>

      {!busy && !showing && p.marks.length ? (
        <Button variant="ghost" arrow={false} className={styles.textAction} onClick={on.clearMarks}>{t.clearMarks}</Button>
      ) : null}
    </CreateScreen>
  );
}
