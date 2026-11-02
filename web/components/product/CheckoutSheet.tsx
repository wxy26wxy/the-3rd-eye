"use client";
import { forwardRef } from "react";
import { m } from "@/components/messages";
import { IconButton } from "@/components/ui/IconButton";
import { CloseIcon } from "@/components/ui/Icons";
import type { BuyState } from "@/app/(site)/p/[id]/actions";
import { BuyFields } from "./BuyForm";
import styles from "./Product.module.css";

/**
 * Checkout sheet (ruling R1: "Add to bag" opens it; the boards draw no bag or checkout). A modal
 * <dialog> inside the product form: the page behind is inert, Esc and Close dismiss it, focus returns to
 * Add to bag. It shows the line item and today's buy fields; Place order submits the whole form.
 */
export const CheckoutSheet = forwardRef<HTMLDialogElement, { summary: string; state: BuyState; pending: boolean; submitLabel: string }>(
  function CheckoutSheet({ summary, state, pending, submitLabel }, ref) {
    return (
      <dialog
        ref={ref}
        id="checkout"
        className={styles.sheet}
        aria-labelledby="checkout-title"
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
      >
        <div className={styles.sheetHead}>
          <h2 id="checkout-title" className={styles.sheetTitle}>{m.product.buyTitle}</h2>
          <IconButton label={m.common.close} size="s" onClick={(e) => e.currentTarget.closest("dialog")?.close()}>
            <CloseIcon size="1.25rem" />
          </IconButton>
        </div>
        <p className={styles.summary}>{summary}</p>
        <BuyFields state={state} pending={pending} submitLabel={submitLabel} />
      </dialog>
    );
  },
);
