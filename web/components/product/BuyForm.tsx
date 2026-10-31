"use client";
import { useActionState } from "react";
import { m } from "@/components/messages";
import { ErrorCard } from "@/components/create/cards";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import type { BuyState } from "@/app/(site)/p/[id]/actions";
import styles from "./Product.module.css";

/** A rejected or unchecked note is about the note field, so it shows under that field (ruling 7). */
const NOTE_ERRORS = new Set([m.product.noteRejected, m.product.noteUnavailable]);

/** Buy this piece (board 2019:2056): name, email, note, demo line, primary. Errors under their field, others above the button. */
export function BuyForm({ action, priceLabel }: { action: (prev: BuyState, fd: FormData) => Promise<BuyState>; priceLabel: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  const noteError = state.error && NOTE_ERRORS.has(state.error) ? state.error : null;
  const formError = state.error && !noteError ? state.error : null;
  return (
    <form action={formAction} className={styles.buyForm} aria-labelledby="buy-title" noValidate>
      <h2 id="buy-title" className={styles.buyTitle}>{m.product.buyTitle}</h2>
      <Field label={m.product.buyName} name="buyerName" autoComplete="name" required defaultValue={state.values?.buyerName} error={state.nameError} />
      <Field label={m.product.buyEmail} name="buyerEmail" type="email" autoComplete="email" inputMode="email" hint={m.product.buyEmailHint} hintPosition="below" defaultValue={state.values?.buyerEmail} />
      <Field label={m.product.buyNote} name="shipNote" multiline rows={3} defaultValue={state.values?.shipNote} error={noteError} />
      <p className={styles.staged}>{m.product.buyStaged}</p>
      {formError ? <ErrorCard>{formError}</ErrorCard> : null}
      <Button type="submit" block disabled={pending} aria-disabled={pending}>
        {pending ? m.product.buyPending : priceLabel}
      </Button>
    </form>
  );
}
