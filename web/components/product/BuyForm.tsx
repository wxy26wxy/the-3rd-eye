"use client";
import { useActionState } from "react";
import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Status } from "@/components/ui/Loading";
import type { BuyState } from "@/app/(site)/p/[id]/actions";
import styles from "./Product.module.css";

export function BuyForm({ action, priceLabel }: { action: (prev: BuyState, fd: FormData) => Promise<BuyState>; priceLabel: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={styles.buyForm} aria-labelledby="buy-title" noValidate>
      <h2 id="buy-title" className={styles.buyTitle}>{m.product.buyTitle}</h2>
      <Field label={m.product.buyName} name="buyerName" autoComplete="name" required defaultValue={state.values?.buyerName} error={state.nameError} />
      <Field label={m.product.buyEmail} name="buyerEmail" type="email" autoComplete="email" inputMode="email" hint={m.product.buyEmailHint} defaultValue={state.values?.buyerEmail} />
      <Field label={m.product.buyNote} name="shipNote" multiline rows={3} defaultValue={state.values?.shipNote} />
      {state.error ? <Status tone="error">{state.error}</Status> : null}
      <Button type="submit" block disabled={pending} aria-disabled={pending}>
        {pending ? m.product.buyPending : priceLabel}
      </Button>
      <p className={styles.staged}>{m.product.buyStaged}</p>
    </form>
  );
}
