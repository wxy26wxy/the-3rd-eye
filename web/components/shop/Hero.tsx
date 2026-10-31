import Image from "next/image";
import { m } from "@/components/messages";
import { ASSETS } from "@/lib/assets";
import { Button } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import styles from "./Shop.module.css";

/**
 * Shop hero (boards 2018:1805 / 2018:1986): full-bleed sky photo (decorative, static: no motion, per
 * the hero-motion note 2035:4133) with the white copy on an ink-55 % scrim panel. The eyebrow sits
 * before the h1, so the heading is only the title.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className={styles.hero}>
      {/* next/image: resized and re-encoded per viewport (the PNG in design/assets stays the source); the LCP image, so priority. */}
      <Image src={ASSETS.heroSky} alt="" fill priority sizes="100vw" className={styles.heroPhoto} />
      <div className={styles.heroInner}>
        <div className={styles.heroPanel}>
          <Eyebrow>{m.shop.heroEyebrow}</Eyebrow>
          <Display as="h1" id="hero-title" size="web" tone="onPhoto">{m.shop.heroTitle}</Display>
          <p className={styles.heroCopy}>{m.shop.heroCopy}</p>
          <div className={styles.heroCtas}>
            <Button href="#collection" variant="white" className={styles.heroPrimary}>{m.shop.ctaShop}</Button>
            <Button href="#how" variant="secondary" arrow={false} className={styles.heroSecondary}>{m.shop.ctaHow}</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
