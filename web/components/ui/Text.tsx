import type { ReactNode } from "react";
import styles from "./Text.module.css";

/** Re-exported from ./Eyebrow so existing `@/components/ui/Text` imports keep working. */
export { Eyebrow } from "./Eyebrow";

export function Title({ children, as: Tag = "h2", size = "l", id, className }: { children: ReactNode; as?: "h1" | "h2" | "h3" | "p"; size?: "l" | "m"; id?: string; className?: string }) {
  return <Tag id={id} className={[size === "l" ? styles.titleL : styles.titleM, className].filter(Boolean).join(" ")}>{children}</Tag>;
}

export function Lead({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={[styles.lead, className].filter(Boolean).join(" ")}>{children}</p>;
}

export function Muted({ children, as: Tag = "p", className }: { children: ReactNode; as?: "p" | "span"; className?: string }) {
  return <Tag className={[styles.muted, className].filter(Boolean).join(" ")}>{children}</Tag>;
}

/** Small non-interactive pill label, e.g. "Made by voice" or "Example artist". `lime` = Green, `cream` = Neutral (Sky Chip). */
export function Chip({ children, tone = "lime" }: { children: ReactNode; tone?: "lime" | "cream" | "ink" }) {
  return <span className={[styles.chip, styles[`chip-${tone}`]].join(" ")}>{children}</span>;
}
