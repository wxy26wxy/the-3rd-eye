"use client";
import { fmt } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import styles from "../Create.module.css";

export type PickItem = { id: string; src: string | null; alt: string };

/**
 * Picture row (Result board `2027:3091`): radio-backed tiles in one row. Selected = accent fill with
 * the accent border and a tick before the label ("✓ Picture 1"), so the choice is not shown by colour
 * alone. Each tile's image carries the picture's description as its alt text.
 */
export function VariantPicker({ name, legend, items, selected, onSelect, itemLabel, placeholder, disabled }: {
  name: string; legend: string; items: PickItem[]; selected?: string; onSelect: (id: string) => void;
  itemLabel: string; placeholder: string; disabled?: boolean;
}) {
  return (
    <fieldset className={styles.fieldset} disabled={disabled}>
      <legend className="visually-hidden">{legend}</legend>
      <ul role="list" className={styles.tiles}>
        {items.map((it, i) => (
          <li key={it.id}>
            <label className={styles.tile}>
              <input className="visually-hidden" type="radio" name={name} value={it.id} checked={selected === it.id} onChange={() => onSelect(it.id)} />
              <ArtImage src={it.src} alt={it.alt} placeholder={placeholder} className={styles.tileArt} />
              <span className={styles.tileLabel}>
                {selected === it.id ? <span aria-hidden="true">✓ </span> : null}{fmt(itemLabel, { n: i + 1 })}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
