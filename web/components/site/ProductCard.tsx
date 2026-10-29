import Link from "next/link";
import type { ShopProduct } from "@/lib/db/queries.contract";
import { fmt, m, money } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { Chip } from "@/components/ui/Text";
import styles from "./ProductCard.module.css";

export function ProductCard({ product, headingLevel = "h3" }: { product: ShopProduct; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  const typeLabel = product.type === "sticker" ? m.common.sticker : m.common.tote;
  return (
    <article className={styles.card}>
      <ArtImage src={product.mockupUrl ?? product.artworkUrl} alt={product.altText ?? fmt(m.product.mockupAlt, { title: product.title, type: typeLabel })} placeholder={m.common.imageMissing} />
      <div className={styles.body}>
        <div className={styles.chips}>
          <Chip tone="cream">{typeLabel}</Chip>
          {product.madeByVoice ? <Chip>{m.common.madeByVoice}</Chip> : null}
        </div>
        <H className={styles.title}>
          <Link href={`/p/${product.id}`} className={styles.link}>{product.title}</Link>
        </H>
        <p className={styles.meta}>
          <span>{fmt(m.common.by, { name: product.creator.displayName })}</span>
          <span className={styles.price}>{money(product.priceCents)}</span>
        </p>
      </div>
    </article>
  );
}
