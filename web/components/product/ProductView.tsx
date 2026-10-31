import Link from "next/link";
import type { ProductDetail } from "@/lib/db/queries.contract";
import { fmt, m, money, sharePercent } from "@/components/messages";
import { placeOrder } from "@/app/(site)/p/[id]/actions";
import { DieCut } from "@/components/site/DieCut";
import { StoryVideo } from "@/components/site/StoryVideo";
import { Avatar } from "@/components/site/Avatar";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { ChevronLeftIcon } from "@/components/ui/Icons";
import { Chip } from "@/components/ui/Text";
import { BuyForm } from "./BuyForm";
import styles from "./Product.module.css";

/**
 * Product page (boards 2019:2004 / 2019:2098). DOM order = reading order: Back to the shop → images
 * (mockup, die-cut preview) → chips → h1 → by artist → price → artist share → description → Buy this
 * piece → The story behind it. Two columns from 64rem, one column below.
 */
export function ProductView({ product: p }: { product: ProductDetail }) {
  const typeLabel = p.type === "sticker" ? m.common.sticker : m.common.tote;
  const alt = p.altText ?? fmt(m.product.mockupAlt, { title: p.title, type: typeLabel });
  const action = placeOrder.bind(null, p.id);
  const story = p.creator.storyText ?? p.creator.bioShort;
  const byLine = fmt(m.common.by, { name: p.creator.displayName });
  return (
    <div className={styles.page}>
      <Link href="/" className={styles.back}><ChevronLeftIcon size="1.25rem" />{m.product.backToShop}</Link>
      <div className={styles.layout}>
        <div className={styles.media}>
          <ArtImage className={styles.mockup} ratio="auto" src={p.mockupUrl ?? p.artworkUrl} alt={alt} eager placeholder={m.common.imageMissing} />
          {p.type === "sticker" ? <DieCut artworkUrl={p.artworkUrl} cutPathSvg={p.cutPathSvg} alt={alt} /> : null}
        </div>
        <div className={styles.info}>
          <div className={styles.chips}>
            <Chip tone="cream">{typeLabel}</Chip>
            {p.madeByVoice ? <Chip>{m.common.madeByVoice}</Chip> : null}
          </div>
          <Display as="h1" size="xl">{p.title}</Display>
          {/* Hidden (testing) creators have no public profile; their product still opens by direct link. */}
          {p.creator.hidden
            ? <p className={styles.by}>{byLine}</p>
            : <p className={styles.by}><Link href={`/c/${p.creator.slug}`} className={styles.byLink}>{byLine}</Link></p>}
          <p className={styles.price}>{money(p.priceCents)}</p>
          <p className={styles.share}>{fmt(m.product.artistShare, { percent: sharePercent(p.creator.split?.creator_bps) })}</p>
          {p.description ? <p className={styles.desc}>{p.description}</p> : null}
          <div className={styles.buyCard}>
            <BuyForm action={action} priceLabel={fmt(m.product.buySubmit, { price: money(p.priceCents) })} />
          </div>
        </div>
      </div>
      <section aria-labelledby="story-title" className={styles.story}>
        <Display id="story-title" size="l">{m.product.storyTitle}</Display>
        <div className={styles.storyBody}>
          <StoryVideo creator={p.creator} className={styles.storyVideo} />
          <div className={styles.storyText}>
            <div className={styles.creatorRow}>
              <Avatar name={p.creator.displayName} src={p.creator.avatarUrl} size="l" />
              <div>
                <p className={styles.creatorName}>{p.creator.displayName}</p>
                {p.creator.studioName ? <p className={styles.studio}>{p.creator.studioName}</p> : null}
              </div>
            </div>
            {p.creator.isExample ? <Chip tone="cream">{m.common.example}</Chip> : null}
            {story ? <p className={styles.storyCopy}>{story}</p> : null}
            {p.creator.hidden ? null : <Button href={`/c/${p.creator.slug}`} variant="secondary" arrow={false} block>{fmt(m.product.seeWork, { name: p.creator.displayName })}</Button>}
          </div>
        </div>
      </section>
    </div>
  );
}
