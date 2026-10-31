import type { ReactNode } from "react";
import styles from "./Eyebrow.module.css";

/** Small caps label above a title or inside a card ("NO PEN NEEDED", "YOU SAID"). Takes the colour of its parent unless `tone` is set. */
export function Eyebrow({ children, as: Tag = "p", tone, id, className }: { children: ReactNode; as?: "p" | "span" | "h2" | "h3"; tone?: "muted" | "accent"; id?: string; className?: string }) {
  return <Tag id={id} className={[styles.eyebrow, tone ? styles[tone] : "", className].filter(Boolean).join(" ")}>{children}</Tag>;
}
