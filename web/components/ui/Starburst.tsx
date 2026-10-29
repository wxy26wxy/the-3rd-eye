import type { ReactNode } from "react";
import styles from "./Starburst.module.css";

function burstPoints(spikes = 14, outer = 50, inner = 41) {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}
const POINTS = burstPoints();

/** Lime starburst badge with short uppercase text, tilted. */
export function Starburst({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={[styles.burst, className].filter(Boolean).join(" ")}>
      <svg viewBox="-4 -4 108 108" aria-hidden="true" focusable="false" className={styles.shape}>
        <polygon points={POINTS} />
      </svg>
      <span className={styles.text}>{children}</span>
    </span>
  );
}
