import { m } from "@/components/messages";
import { Tag } from "@/components/Tag";
import { Button } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { Starburst } from "@/components/ui/Starburst";
import styles from "./Shop.module.css";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className={styles.hero}>
      <div className={styles.heroText}>
        <h1 id="hero-title" className={styles.heroHeading}>
          <span className={styles.heroEyebrow}>{m.shop.heroEyebrow}</span>{" "}
          <Display as="span" size="xl" className={styles.heroDisplay}>{m.shop.heroTitle}</Display>
        </h1>
        <p className={styles.heroCopy}>{m.shop.heroCopy}</p>
        <div className={styles.heroCtas}>
          <Button href="#collection">{m.shop.ctaShop}</Button>
          <Button href="#how" variant="secondary" arrow={false}>{m.shop.ctaHow}</Button>
        </div>
      </div>
      <div className={styles.heroArt} aria-hidden="true">
        <div className={styles.heroBlob}>
          <Tag pose="waving" decorative eager className={styles.heroTag} />
        </div>
        <Starburst className={styles.heroBurst}>{m.shop.heroBurst}</Starburst>
      </div>
    </section>
  );
}
