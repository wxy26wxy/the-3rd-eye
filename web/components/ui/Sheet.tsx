import type { ReactNode } from "react";
import { Scallop } from "./Scallop";
import styles from "./Sheet.module.css";

/** Cream bottom sheet with a scalloped top edge. */
export function Sheet({ children, as: Tag = "section", labelledBy, className }: { children: ReactNode; as?: "section" | "div" | "footer"; labelledBy?: string; className?: string }) {
  return (
    <Tag aria-labelledby={labelledBy} className={[styles.wrap, className].filter(Boolean).join(" ")}>
      <Scallop />
      <div className={styles.sheet}>{children}</div>
    </Tag>
  );
}
