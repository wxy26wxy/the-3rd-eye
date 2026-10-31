import Link from "next/link";
import { m } from "@/components/messages";
import { Wordmark } from "./Wordmark";
import styles from "./Site.module.css";

/** Web footer (board component 2010:504): white on ink (17:1), rounded top, underlined 44 px links. */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <Wordmark tone="white" />
          <p>{m.footer.tagline}</p>
        </div>
        <nav aria-label={m.footer.label}>
          <ul role="list" className={styles.footerList}>
            <li><Link href="/for-studios" className={styles.footerLink}>{m.footer.forStudios}</Link></li>
            <li><Link href="/how-it-works#story-tags" className={styles.footerLink}>{m.footer.storyTags}</Link></li>
            <li><Link href="/how-it-works" className={styles.footerLink}>{m.footer.help}</Link></li>
            <li><Link href="/accessibility" className={styles.footerLink}>{m.footer.accessibility}</Link></li>
            <li><Link href="/create" className={styles.footerLink}>{m.footer.createLink}</Link></li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
