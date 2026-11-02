import type { ReactNode, Ref } from "react";
import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { NoticeCard } from "../cards";
import { CreateScreen } from "../CreateScreen";
import { ErrorNotice, type ScreenError } from "../errors";
import styles from "../Create.module.css";

const a = m.create.adjust;

export type AdjustAreaViewProps = {
  /** Ids of the frame's description: its current size and the keyboard hint. */
  hintId: string;
  sizeId: string;
  /** The frame's current size ("Frame covers 54 by 61 percent of the photo"). */
  sizeText: string;
  back: string;
  retake: string;
  /** No drawing was found on the photo: the frame starts at the whole photo. */
  none: boolean;
  /** "Use this area" is cutting the piece out. */
  busy: boolean;
  /** The photo with the frame (AreaFrame), when the photo and its size are known. */
  photo: ReactNode | null;
  photoState: "loading" | "missing";
  /** The frame's size, said by the polite live region after each drag or key press. */
  announce: string;
  canUse: boolean;
  error: ScreenError | null;
  errorRef?: Ref<HTMLDivElement>;
  on: { use: () => void; reset: () => void };
};

/**
 * Adjust the area (R2; boards "Adjust the area · Web · Sky"): title and copy, the photo on the green
 * photo card with the frame around the picked piece, the keyboard hint, then Use this area / Reset in
 * the pinned bar. While the cut is made, Back and the frame are locked and only Use this area shows
 * (dimmed).
 */
export function AdjustAreaView({ on, errorRef, ...p }: AdjustAreaViewProps) {
  const footer = p.busy ? (
    <Button block disabled aria-busy="true">{a.use}</Button>
  ) : (
    <>
      <Button block onClick={on.use} disabled={!p.canUse}>{a.use}</Button>
      <Button block variant="secondary" arrow={false} onClick={on.reset} disabled={!p.photo}>{a.reset}</Button>
    </>
  );
  return (
    <CreateScreen back={p.busy ? undefined : p.back} title={a.title} lead={p.none ? a.copyNone : a.copy} footer={footer}>
      <p className="visually-hidden" role="status" aria-live="polite">{p.announce}</p>
      {p.photo !== null ? (
        <div className={[styles.photoCard, p.busy ? styles.photoCardBusy : ""].filter(Boolean).join(" ")}>{p.photo}</div>
      ) : p.photoState === "loading" ? <Loading label={m.create.select.loadingPhoto} /> : <NoticeCard>{a.photoMissing}</NoticeCard>}
      {p.photo !== null ? <p id={p.sizeId} className="visually-hidden">{p.sizeText}</p> : null}
      {p.photo !== null && !p.busy ? <p id={p.hintId} className={styles.keyboardHint}>{a.keyboardHint}</p> : null}
      {p.busy ? <Loading inline label={a.applying} /> : null}
      <div ref={errorRef} tabIndex={-1} className={styles.errorSpot}>
        <ErrorNotice error={p.error} onRetry={on.use} retakeHref={p.busy ? undefined : p.retake} />
      </div>
    </CreateScreen>
  );
}
