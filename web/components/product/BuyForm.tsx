import { m } from "@/components/messages";
import { ErrorCard } from "@/components/create/cards";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import type { BuyState } from "@/app/(site)/p/[id]/actions";
import styles from "./Product.module.css";

/**
 * The checkout fields (today's buy form, R1): name, email, note, demo line, primary. They live in the
 * checkout sheet, inside the product's one form, so size and quantity submit with them. The action says
 * where its error belongs (`field`): under the name or the note (a rejected or unchecked note), or above
 * the button for anything else.
 */
export function BuyFields({ state, pending, submitLabel }: { state: BuyState; pending: boolean; submitLabel: string }) {
  const nameError = state.field === "name" ? state.error : undefined;
  const noteError = state.field === "note" ? state.error : undefined;
  const formError = state.error && !nameError && !noteError ? state.error : null;
  return (
    <div className={styles.buyFields}>
      <Field label={m.product.buyName} name="buyerName" autoComplete="name" required defaultValue={state.values?.buyerName} error={nameError} />
      <Field label={m.product.buyEmail} name="buyerEmail" type="email" autoComplete="email" inputMode="email" hint={m.product.buyEmailHint} hintPosition="below" defaultValue={state.values?.buyerEmail} />
      <Field label={m.product.buyNote} name="shipNote" multiline rows={3} defaultValue={state.values?.shipNote} error={noteError} />
      <p className={styles.staged}>{m.product.buyStaged}</p>
      {formError ? <ErrorCard>{formError}</ErrorCard> : null}
      <Button type="submit" block disabled={pending} aria-disabled={pending}>
        {pending ? m.product.buyPending : submitLabel}
      </Button>
    </div>
  );
}
