import type { ReactNode } from "react";
import styles from "./Create.module.css";

export function CreateMain({ children }: { children: ReactNode }) {
  return <main id="main" tabIndex={-1} className={styles.main}>{children}</main>;
}
