import type { ReactNode } from "react";
import styles from "./Loading.module.css";

/** Three bouncing dots with a live text label. Animation stops under reduced motion. */
export function Loading({ label, inline }: { label: string; inline?: boolean }) {
  return (
    <p className={[styles.loading, inline ? styles.inline : ""].join(" ")} role="status" aria-live="polite">
      <span className={styles.dots} aria-hidden="true"><span /><span /><span /></span>
      <span>{label}</span>
    </p>
  );
}

/** Polite live region for status messages. */
export function Status({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" }) {
  return <p role={tone === "error" ? "alert" : "status"} className={[styles.status, styles[tone]].join(" ")}>{children}</p>;
}
