import Link from "next/link";
import { m } from "@/components/messages";
import { LogoMark } from "@/components/ui/LogoMark";
import { BRAND } from "@/lib/brand";
import styles from "./Site.module.css";

/** Eye mark + "The 3rd Eye" in Inter Semi Bold (Sky). The link's name is "{brand} home". */
export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className={styles.wordmark} aria-label={m.nav.home}>
      <LogoMark />
      <span aria-hidden="true">{BRAND.name}</span>
    </Link>
  );
}
