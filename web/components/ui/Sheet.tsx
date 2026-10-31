import type { ReactNode } from "react";
import styles from "./Sheet.module.css";

/** Plain white section (Sky). It used to be a cream sheet with a scalloped edge; the props are unchanged. */
export function Sheet({ children, as: Tag = "section", labelledBy, className }: { children: ReactNode; as?: "section" | "div" | "footer"; labelledBy?: string; className?: string }) {
  return (
    <Tag aria-labelledby={labelledBy} className={[styles.wrap, className].filter(Boolean).join(" ")}>
      <div className={styles.sheet}>{children}</div>
    </Tag>
  );
}
