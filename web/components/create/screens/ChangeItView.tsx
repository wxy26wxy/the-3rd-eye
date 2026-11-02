import type { Ref } from "react";
import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Loading } from "@/components/ui/Loading";
import { ArtPreview, Listening, RecordControl } from "../art";
import { ErrorCard, InfoCard } from "../cards";
import { CreateScreen } from "../CreateScreen";
import { ErrorNotice, type ScreenError } from "../errors";
import styles from "../Create.module.css";

const s = m.create.speak;
const r = m.create.result;

/** The text field of the Change it panel; "Make the change" (in the same card) submits it by this id. */
export const CHANGE_FORM = "change-it-form";

export type ChangePhase = "idle" | "listening" | "transcribing" | "error";

export type ChangeItViewProps = {
  back: string;
  phase: ChangePhase;
  /** The microphone is off (denied or unsupported): the typed path only (board 2026:3135). */
  micOff: string | null;
  art: { src: string | null; alt: string };
  /** What the art on screen shows (its spoken description or alt text). */
  shows: string | null;
  instruction: string;
  seconds: number;
  error: ScreenError | null;
  /** Text for the one persistent polite live region ("Listening"). */
  announce: string;
  /** Focus targets the screen moves focus to after a phase change. */
  refs?: { field?: Ref<HTMLTextAreaElement>; stop?: Ref<HTMLButtonElement>; error?: Ref<HTMLDivElement> };
  on: {
    instruction: (v: string) => void;
    record: () => void;
    stop: () => void;
    typeInstead: () => void;
    submit: () => void;
    skip: () => void;
    retry: () => void;
    tryDifferent: () => void;
  };
};

/**
 * Change it (web boards `2027:3138` entry, `2026:3067` listening, `2026:3135` microphone off,
 * `2038:4060` error; the clarifying-question board `2026:3098` has no counterpart in the change API):
 * the art on screen ("YOUR ART"), what it shows, and one panel with the text field, the record button, then
 * "Make the change" and "Looks good as is" side by side at the bottom of the panel (R4, no pinned bar).
 * Typed and spoken requests end in the same field, so the creator reads what will be sent first.
 */
export function ChangeItView({ on, refs, ...p }: ChangeItViewProps) {
  // Always the first child of every phase, so React keeps the same element (one live region).
  const region = <p className="visually-hidden" role="status" aria-live="polite">{p.announce}</p>;
  const art = <ArtPreview label={s.artLabel} src={p.art.src} alt={p.shows ? "" : p.art.alt} />;
  const field = (
    <form id={CHANGE_FORM} className={styles.form} onSubmit={(e) => { e.preventDefault(); if (p.instruction.trim()) on.submit(); }}>
      <Field ref={refs?.field} multiline rows={3} label={s.textLabel} placeholder={s.textPlaceholder} value={p.instruction} onChange={(e) => on.instruction(e.target.value)} maxLength={1000} />
    </form>
  );

  // R4: one row at the bottom of the change card (stacked on narrow screens and at large text sizes);
  // the screen has no pinned bar.
  const actions = (
    <div className={styles.changeActions}>
      <Button type="submit" form={CHANGE_FORM} arrow={false} disabled={!p.instruction.trim()}>{s.done}</Button>
      <Button variant="secondary" arrow={false} onClick={on.skip}>{r.skip}</Button>
    </div>
  );

  if (p.phase === "error") {
    return (
      <CreateScreen back={p.back} title={s.title}>
        {region}
        {art}
        <div ref={refs?.error} tabIndex={-1} className={styles.errorSpot}><ErrorNotice error={p.error} onRetry={on.retry} /></div>
        <div className={styles.changeActions}>
          <Button arrow={false} onClick={on.skip}>{r.skip}</Button>
          <Button variant="secondary" arrow={false} onClick={on.tryDifferent}>{r.tryDifferent}</Button>
        </div>
      </CreateScreen>
    );
  }

  if (p.phase === "listening" || p.phase === "transcribing") {
    return (
      <CreateScreen back={p.back} title={s.title} lead={s.hint}>
        {region}
        {art}
        {p.phase === "listening"
          ? <Listening seconds={p.seconds} onStop={on.stop} onType={on.typeInstead} stopRef={refs?.stop} />
          : <Loading inline label={s.transcribing} />}
      </CreateScreen>
    );
  }

  if (p.micOff) {
    return (
      <CreateScreen back={p.back} title={s.title} lead={s.hintMicOff}>
        {region}
        {art}
        <ErrorCard live="status">{p.micOff}</ErrorCard>
        <div className={styles.changeCard}>
          {field}
          {actions}
        </div>
      </CreateScreen>
    );
  }

  return (
    <CreateScreen back={p.back} title={r.titleEntry}>
      {region}
      {art}
      {p.shows ? <InfoCard eyebrow={r.shows}><p>{p.shows}</p></InfoCard> : null}
      <div className={styles.changeCard}>
        {field}
        <RecordControl label={s.start} onClick={on.record} />
        {actions}
      </div>
      {p.error ? <ErrorCard>{p.error.message}</ErrorCard> : null}
    </CreateScreen>
  );
}
