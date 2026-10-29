import type { ReactNode } from "react";
import { Wordmark } from "@/components/site/Wordmark";
import { m } from "@/components/messages";
import styles from "./Admin.module.css";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className={styles.bar}>
        <Wordmark href="/admin" />
        <span className={styles.badge}>{m.admin.metaTitle}</span>
      </header>
      <main id="main" tabIndex={-1} className={styles.main}>{children}</main>
    </>
  );
}
