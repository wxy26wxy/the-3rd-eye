import Link from "next/link";
import type { ProductDetail, ShopProduct } from "@/lib/db/queries.contract";
import { fmt, m, sharePercent } from "@/components/messages";
import { Avatar } from "@/components/site/Avatar";
import { ProductCard, toneAt } from "@/components/site/ProductCard";
import { StoryVideo } from "@/components/site/StoryVideo";
import { CheckIcon, PlusIcon } from "@/components/ui/Icons";
import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { splitPercents } from "@/lib/split";
import styles from "./Product.module.css";

/**
 * "{name} earns from every sticker sold." (2019:2049): accentSoft note with a check, and under it the
 * maker's split of every sale ("50% artist · 30% studio · 20% production", from their `split`), as
 * /how-it-works promises.
 */
export function PaysArtistNote({ name, type, split }: { name: string; type: ProductDetail["type"]; split?: ProductDetail["creator"]["split"] | null }) {
  const s = splitPercents(split);
  return (
    <div className={styles.paysGroup}>
      <p className={styles.pays}>
        <span aria-hidden="true" className={styles.paysIcon}><CheckIcon size="1.25rem" /></span>
        {fmt(type === "sticker" ? m.product.paysSticker : m.product.paysTote, { name })}
      </p>
      <p className={styles.split}>{fmt(m.product.splitLine, { artist: s.artist, studio: s.studio, production: s.production })}</p>
    </div>
  );
}

/**
 * Meet the maker (4012:4365): the story video (captions, native controls), the eyebrow, the maker's
 * portrait (decorative, initials without one; T147) beside their name, their own words as a quote, and
 * where to watch it again.
 */
export function MeetMakerCard({ product: p }: { product: Pick<ProductDetail, "type" | "creator"> }) {
  const quote = p.creator.storyText ?? p.creator.bioShort;
  return (
    <section aria-labelledby="maker-title" className={styles.makerCard}>
      <StoryVideo creator={p.creator} className={styles.makerVideo} />
      <div className={styles.makerText}>
        <Eyebrow as="h2" id="maker-title" tone="accent">{m.product.meetMaker}</Eyebrow>
        <div className={styles.makerWhoRow}>
          <Avatar name={p.creator.displayName} src={p.creator.avatarUrl} size="l" tone="deep" />
          <p className={styles.makerWho}>{p.creator.displayName}</p>
        </div>
        {quote ? <blockquote className={styles.quote}><p>“{quote}”</p></blockquote> : null}
        <p className={styles.scan}>{p.type === "sticker" ? m.product.scanSticker : m.product.scanTote}</p>
      </div>
    </section>
  );
}

/**
 * Details & size / Shipping & returns / Image description (4012:4377): native disclosures (<details>),
 * so they open with Enter or Space and announce expanded / collapsed; the 44 px plus circle turns.
 */
export function Disclosures({ product: p }: { product: Pick<ProductDetail, "type" | "description" | "altText" | "spokenDescription" | "creator"> }) {
  const items = [
    {
      title: m.product.detailsTitle,
      body: [
        p.description,
        p.type === "sticker" ? m.product.detailsSticker : m.product.detailsTote,
        fmt(m.product.artistShare, { percent: sharePercent(p.creator.split?.creator_bps) }),
      ],
    },
    { title: m.product.shippingTitle, body: [m.product.shippingCopy] },
    { title: m.product.altTitle, body: [p.altText ?? p.spokenDescription ?? m.product.altMissing] },
  ];
  return (
    <div className={styles.disclosures}>
      {items.map((it) => (
        <details key={it.title} className={styles.disclosure}>
          <summary className={styles.summaryRow}>
            <span>{it.title}</span>
            <span className={styles.expand} aria-hidden="true"><PlusIcon size="1.25rem" /></span>
          </summary>
          <div className={styles.disclosureBody}>
            {it.body.filter(Boolean).map((t) => <p key={t}>{t}</p>)}
          </div>
        </details>
      ))}
    </div>
  );
}

/** More from {name} (4012:4405): header row with "Visit {studio} →", then up to four tiles. */
export function MoreFrom({ creator, products }: { creator: Pick<ProductDetail["creator"], "slug" | "displayName" | "studioName" | "hidden">; products: ShopProduct[] }) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="more-title" className={styles.more}>
      <div className={styles.moreHead}>
        <Display id="more-title" size="l">{fmt(m.product.moreFrom, { name: creator.displayName })}</Display>
        {creator.hidden ? null : (
          <Link href={`/c/${creator.slug}`} className={styles.textAction}>
            {creator.studioName ? fmt(m.product.visitStudio, { studio: creator.studioName }) : fmt(m.product.visitArtist, { name: creator.displayName })}
            <span aria-hidden="true"> →</span>
          </Link>
        )}
      </div>
      <ul role="list" className={styles.moreGrid}>
        {products.slice(0, 4).map((x, i) => <li key={x.id}><ProductCard product={x} tone={toneAt(i + 2)} /></li>)}
      </ul>
    </section>
  );
}
