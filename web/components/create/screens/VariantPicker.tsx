"use client";
import { useEffect, useState } from "react";
import { fmt } from "@/components/messages";
import { speak, stopSpeaking } from "@/components/speech";
import { ArtImage } from "@/components/ui/ArtImage";
import { PlayIcon, StopIcon } from "@/components/ui/Icons";
import styles from "../Create.module.css";

export type PickItem = { id: string; src: string | null; alt: string; spoken?: string | null };

/**
 * Grid of radio-backed picture choices. Each item can have a "hear" play bar that reads
 * its description aloud (kept outside the label so it is its own button).
 */
export function VariantPicker({ name, legend, items, selected, onSelect, itemLabel, hearLabel, stopLabel, placeholder }: {
  name: string; legend: string; items: PickItem[]; selected?: string; onSelect: (id: string) => void;
  itemLabel: string; hearLabel?: string; stopLabel?: string; placeholder: string;
}) {
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => stopSpeaking(), []);
  return (
    <fieldset className={styles.fieldset}>
      <legend className="visually-hidden">{legend}</legend>
      <ul role="list" className={styles.variants}>
        {items.map((it, i) => (
          <li key={it.id} className={styles.variant}>
            <label className={styles.pick}>
              <input type="radio" name={name} value={it.id} checked={selected === it.id} onChange={() => onSelect(it.id)} />
              <ArtImage src={it.src} alt={it.alt} placeholder={placeholder} />
              <span className={styles.pickLabel}>{fmt(itemLabel, { n: i + 1 })}<span className={styles.tick} aria-hidden="true" /></span>
            </label>
            {hearLabel && it.spoken ? (
              <button
                type="button"
                className={styles.playbar}
                aria-pressed={playing === it.id}
                aria-label={`${playing === it.id ? stopLabel : hearLabel}: ${fmt(itemLabel, { n: i + 1 })}`}
                onClick={() => {
                  if (playing === it.id) { stopSpeaking(); setPlaying(null); return; }
                  setPlaying(it.id);
                  speak(it.spoken ?? "", { onEnd: () => setPlaying((p) => (p === it.id ? null : p)) });
                }}
              >
                <span className={styles.playIcon} aria-hidden="true">{playing === it.id ? <StopIcon /> : <PlayIcon />}</span>
                <span aria-hidden="true">{playing === it.id ? stopLabel : hearLabel}</span>
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
