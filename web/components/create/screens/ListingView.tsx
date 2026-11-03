import type { FormEvent, Ref } from "react";
import { m, money } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CheckIcon, SparkleIcon, WarningIcon } from "@/components/ui/Icons";
import { Loading } from "@/components/ui/Loading";
import { Title } from "@/components/ui/Text";
import type { AgentStep } from "../api";
import { StickerLoading } from "../art";
import { CreateScreen } from "../CreateScreen";
import { ErrorNotice, type ScreenError } from "../errors";
import styles from "../Create.module.css";

export const LISTING_FORM = "listing-form";

export type ListingViewProps = {
  uid: string;
  /** The product picture; `shadow` for a sticker preview (its white border reads on the grey card). */
  mockup: { src: string | null; alt: string; shadow?: boolean };
  /** The agent is writing the first draft: the picture, the creating-cutout animation and the writing line; no fields. */
  drafting: boolean;
  /** "Improve with AI" is running (the form stays). */
  improving: boolean;
  submitting: boolean;
  title: string;
  description: string;
  price: string;
  errors: { title?: string; price?: string };
  /** What the creator earns per sale, in cents (null while the price is not valid). */
  earnCents: number | null;
  printOk: boolean | undefined;
  trace: AgentStep[];
  showTrace: boolean;
  error: ScreenError | null;
  /** Wraps the error card, so the screen can bring it into view above the pinned bar. */
  errorRef?: Ref<HTMLDivElement>;
  on: {
    title: (v: string) => void;
    description: (v: string) => void;
    price: (v: string) => void;
    improve: () => void;
    /** Repeats the call that failed (approve or the agent). */
    retry: () => void;
    toggleTrace: () => void;
    submit: (e: FormEvent) => void;
  };
};

/**
 * Get it ready for the shop (boards `2030:3752`, drafting `2030:3804`, error `2030:3832`). Element order
 * follows the board (ruling): the product picture (sticker preview, R1; the tote's AI mockup photo, T130) → Improve with AI → Name → Description → Price → You earn per sale
 * → print check → Show how the AI decided (disclosure) → error card; Put it in the shop in the bar,
 * which submits the form through its `form` attribute. Field errors sit under their field. While the
 * agent drafts (R5) the form is not rendered: the animation (still under reduced motion) and the line.
 */
export function ListingView({ uid, mockup, drafting, improving, submitting, title, description, price, errors, earnCents, printOk, trace, showTrace, error, errorRef, on }: ListingViewProps) {
  const traceId = `${uid}-trace`;
  return (
    <CreateScreen
      back="/create/ready"
      title={m.create.listing.title}
      footer={<Button type="submit" form={LISTING_FORM} block disabled={drafting || improving || submitting}>{submitting ? m.create.listing.submitting : m.create.listing.submit}</Button>}
    >
      <div className={styles.mockup}>
        <ArtImage src={mockup.src} alt={mockup.alt} placeholder={m.common.imageMissing} ratio="auto" eager className={[styles.mockupArt, mockup.shadow ? styles.stickerShadow : ""].filter(Boolean).join(" ")} />
      </div>
      {drafting ? (
        <>
          <StickerLoading />
          <Loading inline label={m.create.listing.drafting} />
          <p className={styles.keyboardHint}>{m.create.listing.draftingHint}</p>
        </>
      ) : (
        <form id={LISTING_FORM} onSubmit={on.submit} className={styles.form} noValidate>
          <Button block variant="secondary" arrow={false} icon={<SparkleIcon />} onClick={on.improve} disabled={improving}>
            {improving ? m.create.listing.improving : m.create.listing.improve}
          </Button>
          <Field label={m.create.listing.name} value={title} onChange={(e) => on.title(e.target.value)} error={errors.title} required maxLength={80} />
          <Field label={m.create.listing.description} multiline rows={3} value={description} onChange={(e) => on.description(e.target.value)} maxLength={600} />
          <Field label={m.create.listing.price} value={price} onChange={(e) => on.price(e.target.value)} inputMode="decimal" error={errors.price} required />
          <p className={styles.earn} aria-live="polite">
            <span>{m.create.listing.earn}</span>
            <span className={styles.earnValue}>{earnCents != null ? money(earnCents) : "—"}</span>
          </p>
          {printOk !== undefined ? (
            <p className={styles.printCheck}>
              <span aria-hidden="true" className={styles.printIcon}>{printOk ? <CheckIcon /> : <WarningIcon />}</span>
              {m.create.listing.printCheck.replace("{status}", printOk ? m.create.listing.printOk : m.create.listing.printWarn)}
            </p>
          ) : null}
          {trace.length ? (
            <>
              <Button variant="ghost" arrow={false} className={styles.textAction} aria-expanded={showTrace} aria-controls={traceId} onClick={on.toggleTrace}>
                {showTrace ? m.create.listing.hideTrace : m.create.listing.showTrace}
              </Button>
              <div id={traceId} className={styles.traceCard} hidden={!showTrace}>
                <Title as="h2" size="m">{m.create.listing.traceTitle}</Title>
                <ol role="list" className={styles.trace}>
                  {trace.map((s, i) => (
                    <li key={i}>
                      <span className={styles.traceTool}>{s.step}. {s.tool ?? m.create.listing.traceNote}</span>{" "}
                      {s.text ?? (s.result !== undefined ? JSON.stringify(s.result) : s.args !== undefined ? JSON.stringify(s.args) : "")}
                    </li>
                  ))}
                </ol>
              </div>
            </>
          ) : null}
          <div ref={errorRef} tabIndex={-1} className={styles.errorSpot}><ErrorNotice error={error} onRetry={on.retry} /></div>
        </form>
      )}
    </CreateScreen>
  );
}
