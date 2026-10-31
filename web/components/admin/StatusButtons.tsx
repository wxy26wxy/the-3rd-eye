"use client";
import { useActionState } from "react";
import { fmt, m } from "@/components/messages";
import type { OrderStatus } from "@/lib/db/queries.contract";
import type { StatusState } from "@/app/admin/actions";
import styles from "./Admin.module.css";

/** Every other status as a 44 px "Mark {status}" pill (ruling 5); the error (danger) under the pills. */
export function StatusButtons({ action, orderId, current, statuses, labels }: {
  action: (prev: StatusState, fd: FormData) => Promise<StatusState>;
  orderId: string; current: OrderStatus; statuses: OrderStatus[]; labels: Record<OrderStatus, string>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={styles.statusForm}>
      <input type="hidden" name="orderId" value={orderId} />
      {statuses.filter((s) => s !== current).map((s) => (
        <button key={s} type="submit" name="status" value={s} className={styles.pill} disabled={pending}>
          {fmt(m.admin.moveTo, { status: labels[s] })}
        </button>
      ))}
      {state.error ? <p role="alert" className={styles.error}>{state.error}</p> : null}
    </form>
  );
}
