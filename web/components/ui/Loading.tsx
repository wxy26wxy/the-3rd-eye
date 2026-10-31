import type { ReactNode } from "react";
import { ASSETS } from "@/lib/assets";
import { Mascot } from "./Mascot";
import styles from "./Loading.module.css";

/**
 * Spinner with a live text label (Sky). `variant="sky"` puts the sky card above it: the animated
 * magnifier mascot, or the still front pose under prefers-reduced-motion. The card is decorative;
 * the label carries the meaning.
 */
export function Loading({ label, inline, variant = "plain" }: { label: string; inline?: boolean; variant?: "plain" | "sky" }) {
  return (
    <div className={[styles.loading, inline ? styles.inline : ""].filter(Boolean).join(" ")} role="status" aria-live="polite">
      {variant === "sky" ? (
        <div className={styles.sky} style={{ backgroundImage: `url(${ASSETS.sky})` }} aria-hidden="true">
          <Mascot pose="magnifier" decorative eager className={styles.skyMascot} />
        </div>
      ) : null}
      <p className={styles.label}>{label}</p>
      <span className={styles.spinner} aria-hidden="true" />
    </div>
  );
}

/** Polite live region for status messages. */
export function Status({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" }) {
  return <p role={tone === "error" ? "alert" : "status"} className={[styles.status, styles[tone]].join(" ")}>{children}</p>;
}
