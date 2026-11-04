import Image from "next/image";
import { m } from "@/components/messages";
import { ASSETS } from "@/lib/assets";
import { Button } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { CheckIcon } from "@/components/ui/Icons";
import styles from "./Shop.module.css";

/**
 * Shop hero v3 (board 2018:1805): copy on color.page at the left, the rounded photo card at the right
 * (Note · Hero motion 2035:4134: text never sits on the photo, no motion). The photo is decorative; the
 * eyebrow sits before the h1, so the heading is only the title. The "Tap the tag" chip on the photo was removed on 2026-11-04 (founder).
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className={styles.hero}>
      <div className={styles.heroText}>
        <Eyebrow tone="accent">{m.shop.heroEyebrow}</Eyebrow>
        <Display as="h1" id="hero-title" size="web">
          {m.shop.heroTitle1} <span className={styles.line}>{m.shop.heroTitle2}</span>
        </Display>
        <p className={styles.heroCopy}>{m.shop.heroCopy}</p>
        <div className={styles.heroCtas}>
          <Button href="#collection" className={styles.heroPrimary}>{m.shop.ctaShop}</Button>
          <Button href="#how" variant="secondary" arrow={false} className={styles.heroSecondary}>{m.shop.ctaHow}</Button>
        </div>
        <p className={styles.trust}>
          <span className={styles.trustCheck} aria-hidden="true"><CheckIcon size="0.875rem" /></span>
          {m.shop.heroTrust}
        </p>
      </div>
      <div className={styles.heroCard}>
        {/* next/image: resized and re-encoded per viewport; the LCP image, so priority. */}
        <Image src={ASSETS.heroSky} alt="" fill priority sizes="(min-width: 64rem) 50vw, 100vw" className={styles.heroPhoto} />
      </div>
    </section>
  );
}
