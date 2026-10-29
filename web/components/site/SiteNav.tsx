import Link from "next/link";
import { m } from "@/components/messages";
import { Wordmark } from "./Wordmark";
import styles from "./Site.module.css";

const LINKS = [
  { href: "/#collection", label: m.nav.shop },
  { href: "/artists", label: m.nav.artists },
  { href: "/how-it-works", label: m.nav.howItWorks },
  { href: "/for-studios", label: m.nav.forStudios },
];

export function SiteNav() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Wordmark />
        <nav aria-label={m.nav.label} className={styles.nav}>
          <ul role="list" className={styles.navList}>
            {LINKS.map((l) => (
              <li key={l.href}><Link href={l.href} className={styles.navLink}>{l.label}</Link></li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
