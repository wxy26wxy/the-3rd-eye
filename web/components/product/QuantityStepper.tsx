import { m } from "@/components/messages";
import { MinusIcon, PlusIcon } from "@/components/ui/Icons";
import { MAX_QUANTITY, MIN_QUANTITY, clampQuantity } from "./sizes";
import styles from "./Product.module.css";

/**
 * Quantity (4011:4411): Decrease, the value, Increase in a 56 px outlined pill. The value is announced
 * when it changes and submits as the hidden `quantity` field. At the limits the button is disabled.
 */
export function QuantityStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className={styles.stepper} role="group" aria-labelledby="qty-label">
      <span id="qty-label" className="visually-hidden">{m.product.quantityLabel}</span>
      <button type="button" className={styles.stepBtn} aria-label={m.product.decrease} disabled={value <= MIN_QUANTITY} onClick={() => onChange(clampQuantity(value - 1))}>
        <MinusIcon size="1.25rem" />
      </button>
      <output className={styles.stepValue} aria-live="polite" aria-atomic="true">{value}</output>
      <button type="button" className={styles.stepBtn} aria-label={m.product.increase} disabled={value >= MAX_QUANTITY} onClick={() => onChange(clampQuantity(value + 1))}>
        <PlusIcon size="1.25rem" />
      </button>
      <input type="hidden" name="quantity" value={value} />
    </div>
  );
}
