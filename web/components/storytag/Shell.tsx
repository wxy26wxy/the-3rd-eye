import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import styles from "./StoryTag.module.css";

/**
 * Story tag frame (board 2024:2428): the site nav and footer around a phone-width column that stays
 * centred at 640 px on wider screens (ruling 6).
 */
export function StoryTagShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav />
      <main id="main" tabIndex={-1} className={styles.main}>{children}</main>
      <SiteFooter />
    </>
  );
}
