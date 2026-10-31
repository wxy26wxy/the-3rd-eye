import Link from "next/link";
import { m } from "@/components/messages";
import { LogoMark } from "@/components/ui/LogoMark";
import { BRAND } from "@/lib/brand";
import styles from "./Site.module.css";

/** Eye mark + "The 3rd Eye" in Inter Semi Bold 18 (Sky). The link's name is "{brand} home". `tone="white"` on the ink footer. */
export function Wordmark({ href = "/", tone = "ink" }: { href?: string; tone?: "ink" | "white" }) {
  return (
    <Link href={href} className={[styles.wordmark, tone === "white" ? styles.wordmarkWhite : ""].filter(Boolean).join(" ")} aria-label={m.nav.home}>
      <LogoMark tone={tone} />
      <span aria-hidden="true">{BRAND.name}</span>
    </Link>
  );
}
