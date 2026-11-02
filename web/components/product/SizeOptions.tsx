import { m } from "@/components/messages";
import type { SizeKey, SizeOption } from "./sizes";
import styles from "./Product.module.css";

/**
 * Size (4011:4401): a radio group drawn as 44 px pills, selected = ink fill. Native radios named
 * `size`, so the choice submits with the order form (and works without JavaScript).
 */
export function SizeOptions({ sizes, value, onChange }: { sizes: SizeOption[]; value: SizeKey | null; onChange: (key: SizeKey) => void }) {
  return (
    <fieldset className={styles.sizes}>
      <legend className={styles.fieldLabel}>{m.product.sizeLabel}</legend>
      <div className={styles.sizeRow}>
        {sizes.map((s) => (
          <label key={s.key} className={styles.sizeOption}>
            <input type="radio" name="size" value={s.key} checked={value === s.key} onChange={() => onChange(s.key)} className={styles.sizeInput} />
            <span className={styles.sizePill}>{s.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
