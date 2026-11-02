import Link from "next/link";
import type { ShopProduct } from "@/lib/db/queries.contract";
import { fmt, m, money } from "@/components/messages";
import styles from "./ProductCard.module.css";

/** Tile backgrounds in board order (2018:1836 → 2018:1900): accent, white, accentSoft, surfaceAlt. */
export const TILE_TONES = ["accent", "white", "soft", "alt"] as const;
export type TileTone = (typeof TILE_TONES)[number];
export const toneAt = (i: number): TileTone => TILE_TONES[i % TILE_TONES.length];

/**
 * Web product card, Size=Tile (4006:4357): a tinted picture with the STORY TAG pill, then title and
 * price on one row and "STICKER · artist · studio" under it. A sticker shows its cutout on the tint;
 * a tote (or a sticker without a cutout) shows its mockup photo filling the picture. The title link is
 * the accessible name; the whole tile is its click target.
 */
export function ProductCard({ product, headingLevel = "h3", tone = "accent" }: { product: ShopProduct; headingLevel?: "h2" | "h3"; tone?: TileTone }) {
  const H = headingLevel;
  const typeLabel = product.type === "sticker" ? m.common.sticker : m.common.tote;
  const cutout = product.type === "sticker" && product.artworkUrl ? product.artworkUrl : null;
  const src = cutout ?? product.mockupUrl ?? product.artworkUrl;
  const alt = product.altText ?? fmt(m.product.mockupAlt, { title: product.title, type: typeLabel });
  const byLine = [product.creator.displayName, product.creator.studioName].filter(Boolean).join(m.common.listSeparator);
  return (
    <article className={styles.card}>
      <div className={[styles.picture, styles[tone]].join(" ")}>
        {src
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={src} alt={alt} loading="lazy" decoding="async" className={cutout ? styles.cutout : styles.photo} />
          : <span className={styles.missing} role="img" aria-label={alt}><span aria-hidden="true">{m.common.imageMissing}</span></span>}
        <span className={styles.tag} aria-hidden="true"><span className={styles.dot} />{m.product.storyTagShort}</span>
      </div>
      <div className={styles.info}>
        <div className={styles.titleRow}>
          <H className={styles.title}>
            <Link href={`/p/${product.id}`} className={styles.link}>{product.title}</Link>
          </H>
          <p className={styles.price}>{money(product.priceCents)}</p>
        </div>
        <p className={styles.meta}>
          <span className={styles.type}>{typeLabel}</span>
          {m.common.listSeparator}
          {byLine}
        </p>
      </div>
    </article>
  );
}
