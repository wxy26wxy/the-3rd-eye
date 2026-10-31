import Link from "next/link";
import type { ShopProduct } from "@/lib/db/queries.contract";
import { fmt, m, money } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { Chip } from "@/components/ui/Text";
import styles from "./ProductCard.module.css";

/**
 * Web product card (board component 2035:4130). Large (300 px, desktop grids) and Small (163 px, two per
 * row at 390) are one component: under 12.5rem of width a container query stacks the chips and tightens
 * the body. The title link is the accessible name; the whole card is its click target.
 */
export function ProductCard({ product, headingLevel = "h3" }: { product: ShopProduct; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  const typeLabel = product.type === "sticker" ? m.common.sticker : m.common.tote;
  return (
    <article className={styles.card}>
      <div className={styles.inner}>
        <ArtImage className={styles.image} src={product.mockupUrl ?? product.artworkUrl} alt={product.altText ?? fmt(m.product.mockupAlt, { title: product.title, type: typeLabel })} placeholder={m.common.imageMissing} />
        <div className={styles.body}>
          <div className={styles.chips}>
            <Chip tone="cream">{typeLabel}</Chip>
            {product.madeByVoice ? <Chip>{m.common.madeByVoice}</Chip> : null}
          </div>
          <H className={styles.title}>
            <Link href={`/p/${product.id}`} className={styles.link}>{product.title}</Link>
          </H>
          <p className={styles.meta}>
            <span className={styles.artist}>{fmt(m.common.by, { name: product.creator.displayName })}</span>
            <span className={styles.price}>{money(product.priceCents)}</span>
          </p>
        </div>
      </div>
    </article>
  );
}
