import Link from "next/link";
import { m } from "@/components/messages";
import { NavMenu } from "./NavMenu";
import { NAV_LINKS } from "./navLinks";
import { Wordmark } from "./Wordmark";
import styles from "./Site.module.css";

/**
 * Web nav (board component 2010:467): wordmark left, four 44 px links right from 48rem; on phones the
 * links collapse into the Menu button that opens the Nav drawer (2032:4004, ruling 3).
 */
export function SiteNav() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Wordmark />
        <nav aria-label={m.nav.label} className={styles.nav}>
          <ul role="list" className={styles.navList}>
            {NAV_LINKS.map((l) => (
              <li key={l.href}><Link href={l.href} className={styles.navLink}>{l.label}</Link></li>
            ))}
          </ul>
        </nav>
        <NavMenu />
      </div>
    </header>
  );
}
