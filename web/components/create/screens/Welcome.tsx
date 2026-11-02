import { m } from "@/components/messages";
import { ASSETS } from "@/lib/assets";
import { Button } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { LogoMark } from "@/components/ui/LogoMark";
import styles from "../Create.module.css";

/** " / " in a board string is a forced line break (docs/design/copy-v3-web.md conventions). */
const LINES = m.create.welcome.title.split(" / ");

/**
 * Welcome (board `2026:2865`, v3): the open sky photo with no panels (ruling R5: the white title on
 * the bare sky is the accepted contrast exception, docs/accessibility.md); the white "Start creating"
 * pill and the ink text action "I already have an account" at the bottom.
 */
export function Welcome() {
  return (
    <div className={styles.welcome}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ASSETS.welcomeBg} alt="" className={styles.welcomeBg} fetchPriority="high" />
      <div className={styles.welcomeTop}>
        <LogoMark tone="white" />
        <Display as="h1" size="xl" tone="onPhoto" className={styles.welcomeTitle}>
          {LINES.map((line, i) => <span key={line} className={styles.welcomeLine}>{line}{i < LINES.length - 1 ? " " : ""}</span>)}
        </Display>
      </div>
      <div className={styles.welcomeBottom}>
        <Button href="/create/product" variant="white" block>{m.create.welcome.cta}</Button>
        <div className={styles.welcomeLinks}>
          <Button href="/create/code" variant="ghost" arrow={false}>{m.create.welcome.haveAccount}</Button>
        </div>
      </div>
    </div>
  );
}
