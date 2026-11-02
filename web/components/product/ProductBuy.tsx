"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { fmt, m, money } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import type { ProductType } from "@/lib/db/queries.contract";
import type { BuyState } from "@/app/(site)/p/[id]/actions";
import { CheckoutSheet } from "./CheckoutSheet";
import { QuantityStepper } from "./QuantityStepper";
import { SizeOptions } from "./SizeOptions";
import { DEFAULT_SIZE, sizeLabel, sizesFor, unitCents, type SizeKey } from "./sizes";
import styles from "./Product.module.css";

/**
 * Price, Size, Quantity + Add to bag (2019:2040), and the checkout sheet, all in one form bound to
 * `placeOrder`: the sheet's fields, `size` and `quantity` submit together (R1). The price follows the size.
 */
export function ProductBuy({ action, type, title, priceCents }: {
  action: (prev: BuyState, fd: FormData) => Promise<BuyState>; type: ProductType; title: string; priceCents: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const sizes = sizesFor(type);
  const [size, setSize] = useState<SizeKey | null>(DEFAULT_SIZE[type]);
  const [quantity, setQuantity] = useState(1);
  const sheet = useRef<HTMLDialogElement>(null);
  const unit = unitCents({ type, priceCents }, size);
  
  const open = () => {
    const d = sheet.current;
    if (!d || d.open) return;
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
  };
  // A refused order reopens the sheet (e.g. after a submit that closed it), so its error is seen.
  useEffect(() => { if (state.error) open(); }, [state]);

  return (
    <form action={formAction} noValidate className={styles.buy}>
      <p className={styles.price} aria-live="polite">{money(unit)}</p>
      {sizes.length ? <SizeOptions sizes={sizes} value={size} onChange={setSize} /> : null}
      <div className={styles.buyRow}>
        <QuantityStepper value={quantity} onChange={setQuantity} />
        <Button type="button" className={styles.addToBag} aria-haspopup="dialog" aria-controls="checkout" onClick={open}>
          {m.product.addToBag}
        </Button>
      </div>
      <CheckoutSheet
        ref={sheet}
        summary={size
          ? fmt(m.product.orderSummary, { title, size: sizeLabel(size), quantity })
          : fmt(m.product.orderSummaryNoSize, { title, quantity })}
        state={state}
        pending={pending}
        submitLabel={fmt(m.product.buySubmit, { price: money(unit * quantity) })}
      />
    </form>
  );
}
