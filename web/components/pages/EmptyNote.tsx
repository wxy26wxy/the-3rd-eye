import type { ReactNode } from "react";
import styles from "./Pages.module.css";

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
