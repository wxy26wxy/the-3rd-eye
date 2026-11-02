import type { ReactNode } from "react";
import { fmt, m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { LogoMark } from "@/components/ui/LogoMark";
import { PlayIcon } from "@/components/ui/Icons";
import { ASSETS } from "@/lib/assets";
import styles from "./Shop.module.css";

const STEPS = [
  { title: m.shop.step1Title, copy: m.shop.step1Copy },
  { title: m.shop.step2Title, copy: m.shop.step2Copy },
  { title: m.shop.step3Title, copy: m.shop.step3Copy },
];

/**
 * Story tags band (board 2018:1922 › 4010:4348): green band with the eyebrow, "Every piece / talks.",
 * three numbered steps (an ordered list), the primary link, and the phone preview at the right
 * (illustrative, hidden from assistive tech). `preview` is streamed in by the page.
 */
export function HowSteps({ id = "how", preview }: { id?: string; preview?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={styles.band} tabIndex={-1}>
      <div className={styles.bandCopy}>
        <Eyebrow tone="accent">{m.shop.bandEyebrow}</Eyebrow>
        <Display id={`${id}-title`} size="web">
          {m.shop.bandTitle1} <span className={styles.line}>{m.shop.bandTitle2}</span>
        </Display>
        <ol className={styles.steps} role="list">
          {STEPS.map((s, i) => (
            <li key={s.title} className={styles.step}>
              <span className={styles.stepNum} aria-hidden="true">{i + 1}</span>
              <div className={styles.stepText}>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepCopy}>{s.copy}</p>
              </div>
            </li>
          ))}
        </ol>
        <Button href="/how-it-works#story-tags" block>{m.shop.bandCta}</Button>
      </div>
      {preview ?? <PhonePreview name={null} studio={null} bio={null} product={null} />}
    </section>
  );
}

/** Phone preview of a story-tag page (4010:4376). Illustrative: aria-hidden, nothing in it is focusable. */
export function PhonePreview({ name, studio, bio, product }: {
  name: string | null; studio: string | null; bio: string | null; product: { title: string; imageUrl: string | null; type: "sticker" | "tote" } | null;
}) {
  return (
    <div className={styles.phone} aria-hidden="true">
      <LogoMark />
      <div className={styles.phoneIntro}>
        <p className={styles.phoneEyebrow}>{[m.shop.previewEyebrow, studio].filter(Boolean).join(m.common.listSeparator)}</p>
        <p className={styles.phoneHi}>{name ? fmt(m.shop.previewHi, { name }) : m.shop.previewHiFallback}</p>
        {bio ? <p className={styles.phoneBio}>{bio}</p> : null}
      </div>
      <div className={styles.phoneVideo} style={{ backgroundImage: `url(${ASSETS.heroSky})` }}>
        <span className={styles.playCircle}><PlayIcon size="1.25rem" /></span>
      </div>
      {product ? (
        <div className={styles.phoneProduct}>
          <span className={styles.phoneThumb}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" decoding="async" /> : null}
          </span>
          <span className={styles.phoneProductText}>
            <span className={styles.phoneProductTitle}>{product.title}</span>
            <span className={styles.phoneProductNote}>{fmt(m.shop.previewProduct, { type: product.type === "sticker" ? m.common.sticker : m.common.tote })}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
