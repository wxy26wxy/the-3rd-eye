import type { ReactNode } from "react";
import styles from "./Pages.module.css";

/** Empty state: one line on the grey rounded card (boards 2024:2652, 2025:2929). */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
