import Link from "next/link";
import type { ReactNode } from "react";
import { m } from "@/components/messages";
import { LogoMark } from "@/components/ui/LogoMark";
import styles from "./Admin.module.css";

/** Admin header (board 2031:3896): eye mark + "{brand} · Admin" (admin.header, brand from lib/brand). */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className={styles.bar}>
        <Link href="/admin" className={styles.home}>
          <LogoMark />
          <span>{m.admin.header}</span>
        </Link>
      </header>
      <main id="main" tabIndex={-1} className={styles.main}>{children}</main>
    </>
  );
}
