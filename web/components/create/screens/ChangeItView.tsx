import type { Ref } from "react";
import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Loading } from "@/components/ui/Loading";
import { ArtPreview, Listening, RecordControl, StickerLoading } from "../art";
import { ErrorCard, InfoCard } from "../cards";
import { CreateScreen } from "../CreateScreen";
import { ErrorNotice, type ScreenError } from "../errors";
import styles from "../Create.module.css";

const s = m.create.speak;
const r = m.create.result;

/** The text field of the Change it panel; "Make the change" (in the same card) submits it by this id. */
export const CHANGE_FORM = "change-it-form";
/** The "Your sticker is being made" hint the two waiting buttons point at. */
export const WAIT_HINT = "change-it-wait";

export type ChangePhase = "idle" | "listening" | "transcribing" | "error";

export type ChangeItViewProps = {
  back: string;
  phase: ChangePhase;
  /** The microphone is off (denied or unsupported): the typed path only (board 2026:3135). */
  micOff: string | null;
  /** The product photo (round 4 ruling 2: the sticker / tote bag of the art on screen). */
  art: { src: string | null; alt: string };
  /**
   * The making state (round 4 ruling 2): the sticker / tote bag is being made (or its rebuilt photo
   * read); the creating animation and `status` take the picture's place, and "Make the change" and
   * "Looks good as is" wait (`aria-disabled`, still focusable, pointing at `hint`). `error`: the
   * product call failed (Try again).
   */
  making: { status: string; hint: string; error: ScreenError | null } | null;
  /** "Fix the cutout" is offered (the art on screen has a cut and its product is made). */
  canFix: boolean;
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
    fix: () => void;
    retryProduct: () => void;
  };
};

/**
 * Change it (web boards `2027:3138` entry, `2026:3067` listening, `2026:3135` microphone off,
 * `2038:4060` error; the clarifying-question board `2026:3098` has no counterpart in the change API):
 * the product photo of the art on screen ("YOUR ART"; round 4 ruling 2: the sticker / tote bag, or the
 * creating animation with "Making your sticker…" while it is made), what it shows, and one panel with
 * the text field, the record button, then "Make the change" and "Looks good as is" side by side at the
 * bottom of the panel (R4, no pinned bar; both wait with the hint while the product is made), then
 * the "Fix the cutout" link.
 * Typed and spoken requests end in the same field, so the creator reads what will be sent first.
 */
export function ChangeItView({ on, refs, ...p }: ChangeItViewProps) {
  // Always the first child of every phase, so React keeps the same element (one live region).
  const region = <p className="visually-hidden" role="status" aria-live="polite">{p.announce}</p>;
  const wait = p.making !== null;
  const art = p.making ? (
    <div className={styles.productMaking}>
      <StickerLoading />
      {p.making.error ? <ErrorNotice error={p.making.error} onRetry={on.retryProduct} /> : <Loading inline label={p.making.status} />}
    </div>
  ) : <ArtPreview key={p.art.src ?? "none"} label={s.artLabel} src={p.art.src} alt={p.art.alt} className={styles.productPhoto} />;
  // While the product is made the two buttons wait: still focusable and read, they do nothing.
  const waiting = wait ? { "aria-disabled": true as const, "aria-describedby": WAIT_HINT } : {};
  const hint = p.making ? <p id={WAIT_HINT} className={styles.waitHint}>{p.making.hint}</p> : null;
  const fix = p.canFix && !wait ? <Button variant="ghost" arrow={false} onClick={on.fix}>{r.fixCutout}</Button> : null;
  const skip = () => { if (!wait) on.skip(); };
  const field = (
    <form id={CHANGE_FORM} className={styles.form} onSubmit={(e) => { e.preventDefault(); if (!wait && p.instruction.trim()) on.submit(); }}>
      <Field ref={refs?.field} multiline rows={3} label={s.textLabel} placeholder={s.textPlaceholder} value={p.instruction} onChange={(e) => on.instruction(e.target.value)} maxLength={1000} />
    </form>
  );

  // R4: one row at the bottom of the change card (stacked on narrow screens and at large text sizes);
  // the screen has no pinned bar.
  const actions = (
    <>
      <div className={styles.changeActions}>
        <Button type="submit" form={CHANGE_FORM} arrow={false} disabled={!wait && !p.instruction.trim()} {...waiting}>{s.done}</Button>
        <Button variant="secondary" arrow={false} onClick={skip} {...waiting}>{r.skip}</Button>
      </div>
      {hint}
    </>
  );

  if (p.phase === "error") {
    return (
      <CreateScreen back={p.back} title={s.title}>
        {region}
        {art}
        <div ref={refs?.error} tabIndex={-1} className={styles.errorSpot}><ErrorNotice error={p.error} onRetry={on.retry} /></div>
        <div className={styles.changeActions}>
          <Button arrow={false} onClick={skip} {...waiting}>{r.skip}</Button>
          <Button variant="secondary" arrow={false} onClick={on.tryDifferent}>{r.tryDifferent}</Button>
        </div>
        {hint}
        {fix}
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
        {fix}
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
      {fix}
      {p.error ? <ErrorCard>{p.error.message}</ErrorCard> : null}
    </CreateScreen>
  );
}
