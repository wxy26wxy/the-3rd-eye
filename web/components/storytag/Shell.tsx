import type { ReactNode } from "react";
import { Wordmark } from "@/components/site/Wordmark";
import styles from "./StoryTag.module.css";

/** Mobile-first frame for story-tag pages: wordmark bar and a narrow main column. */
export function StoryTagShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.bar}><Wordmark /></header>
      <main id="main" tabIndex={-1} className={styles.main}>{children}</main>
    </div>
  );
}
