import type { ReactNode } from "react";
import { ASSETS } from "@/lib/assets";
import { Mascot } from "./Mascot";
import styles from "./Loading.module.css";

/**
 * Spinner with a live text label (Sky). `variant="sky"` puts the sky card above it (the searching
 * mascot MP4; the still front pose on the sky photo under prefers-reduced-motion). `inline` puts the
 * spinner left of the label in one row. The card is decorative; the label carries the meaning.
 */
export function Loading({ label, inline, variant = "plain" }: { label: string; inline?: boolean; variant?: "plain" | "sky" }) {
  return (
    <div className={[styles.loading, inline ? styles.inline : ""].filter(Boolean).join(" ")} role="status" aria-live="polite">
      {variant === "sky" ? <SkyCard animated /> : null}
      <p className={styles.label}>{label}</p>
      <span className={styles.spinner} aria-hidden="true" />
    </div>
  );
}

/**
 * Sky card (Components page `2007:244`): 28 px radius, the sky photo with the mascot standing on it.
 * `animated` plays the searching MP4 over it instead (still pose under reduced motion). Decorative.
 */
export function SkyCard({ animated, className }: { animated?: boolean; className?: string }) {
  return (
    <div className={[styles.sky, className].filter(Boolean).join(" ")} style={{ backgroundImage: `url(${ASSETS.sky})` }} aria-hidden="true">
      {animated
        ? <Mascot pose="magnifier" decorative eager className={styles.skyMotion} />
        : <Mascot pose="front" decorative eager className={styles.skyStill} />}
    </div>
  );
}

/** Polite live region for status messages. */
export function Status({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" }) {
  return <p role={tone === "error" ? "alert" : "status"} className={[styles.status, styles[tone]].join(" ")}>{children}</p>;
}
