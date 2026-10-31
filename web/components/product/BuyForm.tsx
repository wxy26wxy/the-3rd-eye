"use client";
import { useActionState } from "react";
import { m } from "@/components/messages";
import { ErrorCard } from "@/components/create/cards";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import type { BuyState } from "@/app/(site)/p/[id]/actions";
import styles from "./Product.module.css";

/**
 * Buy this piece (board 2019:2056): name, email, note, demo line, primary. The action says where its
 * error belongs (`field`): under the name or the note (a rejected or unchecked note, ruling 7), or
 * above the button for anything else.
 */
export function BuyForm({ action, priceLabel }: { action: (prev: BuyState, fd: FormData) => Promise<BuyState>; priceLabel: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  const nameError = state.field === "name" ? state.error : undefined;
  const noteError = state.field === "note" ? state.error : undefined;
  const formError = state.error && !nameError && !noteError ? state.error : null;
  return (
    <form action={formAction} className={styles.buyForm} aria-labelledby="buy-title" noValidate>
      <h2 id="buy-title" className={styles.buyTitle}>{m.product.buyTitle}</h2>
      <Field label={m.product.buyName} name="buyerName" autoComplete="name" required defaultValue={state.values?.buyerName} error={nameError} />
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
