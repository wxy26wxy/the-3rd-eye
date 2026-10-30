import Link from "next/link";
import { m } from "@/components/messages";
import { BRAND } from "@/lib/brand";
import styles from "./Site.module.css";

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className={styles.wordmark} aria-label={m.nav.home}>
      <span aria-hidden="true">{BRAND.wordmark}</span>
    </Link>
  );
}
