import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Loading } from "@/components/ui/Loading";
import { ArtPreview, Listening, RecordControl, TextAction } from "../art";
import { ErrorCard, InfoCard } from "../cards";
import { CreateScreen } from "../CreateScreen";
import { ErrorNotice, type ScreenError } from "../errors";
import styles from "../Create.module.css";

const s = m.create.speak;
const r = m.create.result;

/** The text field of the Change it panel; the bar's "Make the change" submits it by this id. */
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
 * `2038:4060` error; the clarifying-question board `2026:3098` has no counterpart in the change API): the art on screen ("YOUR ART"), what it shows, and
 * one panel with the text field, the record button, "Make the change" and "Looks good as is".
 * Typed and spoken requests end in the same field, so the creator reads what will be sent first.
 */
export function ChangeItView({ on, ...p }: ChangeItViewProps) {
  const art = <ArtPreview label={s.artLabel} src={p.art.src} alt={p.shows ? "" : p.art.alt} />;
  const field = (
    <form id={CHANGE_FORM} className={styles.form} onSubmit={(e) => { e.preventDefault(); if (p.instruction.trim()) on.submit(); }}>
      <Field multiline rows={3} label={s.textLabel} placeholder={s.textPlaceholder} value={p.instruction} onChange={(e) => on.instruction(e.target.value)} maxLength={1000} />
    </form>
  );

  if (p.phase === "error") {
    return (
      <CreateScreen
        back={p.back}
        title={s.title}
        footer={<>
          <Button block onClick={on.skip}>{r.skip}</Button>
          <Button block variant="secondary" arrow={false} onClick={on.tryDifferent}>{r.tryDifferent}</Button>
        </>}
      >
        {art}
        <ErrorNotice error={p.error} onRetry={on.retry} />
      </CreateScreen>
    );
  }

  if (p.phase === "listening" || p.phase === "transcribing") {
    return (
      <CreateScreen back={p.back} title={s.title} lead={s.hint}>
        {art}
        {p.phase === "listening"
          ? <Listening seconds={p.seconds} onStop={on.stop} onType={on.typeInstead} />
          : <Loading inline label={s.transcribing} />}
      </CreateScreen>
    );
  }

  if (p.micOff) {
    return (
      <CreateScreen
        back={p.back}
        title={s.title}
        lead={s.hintMicOff}
        footer={<>
          <Button type="submit" form={CHANGE_FORM} block disabled={!p.instruction.trim()}>{s.done}</Button>
          <Button variant="ghost" arrow={false} className={styles.textAction} onClick={on.skip}>{r.skip}</Button>
        </>}
      >
        {art}
        <ErrorCard live="status">{p.micOff}</ErrorCard>
        {field}
      </CreateScreen>
    );
  }

  return (
    <CreateScreen back={p.back} title={r.titleEntry}>
      {art}
      {p.shows ? <InfoCard eyebrow={r.shows}><p>{p.shows}</p></InfoCard> : null}
      <div className={styles.changeCard}>
        {field}
        <RecordControl label={s.start} onClick={on.record} />
        <Button type="submit" form={CHANGE_FORM} block disabled={!p.instruction.trim()}>{s.done}</Button>
        <TextAction onClick={on.skip}>{r.skip}</TextAction>
      </div>
      {p.error ? <ErrorCard>{p.error.message}</ErrorCard> : null}
    </CreateScreen>
  );
}
