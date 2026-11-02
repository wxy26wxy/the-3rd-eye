import Link from "next/link";
import type { ProductDetail, ShopProduct } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { placeOrder } from "@/app/(site)/p/[id]/actions";
import { Avatar } from "@/components/site/Avatar";
import { ChevronLeftIcon } from "@/components/ui/Icons";
import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Chip } from "@/components/ui/Text";
import { Gallery, type GallerySlide } from "./Gallery";
import { ProductBuy } from "./ProductBuy";
import { Disclosures, MeetMakerCard, MoreFrom, PaysArtistNote } from "./ProductParts";
import styles from "./Product.module.css";

/** Gallery pictures in board order (4011:4378): the piece on the accent, the art on a white card, the photo, the story tag. */
export function gallerySlides(p: Pick<ProductDetail, "type" | "artworkUrl" | "mockupUrl" | "creator">): GallerySlide[] {
  const slides: (GallerySlide | null)[] = p.type === "sticker"
    ? [
        p.artworkUrl ? { kind: "image", src: p.artworkUrl, fit: "contain", tone: "accent" } : null,
        p.artworkUrl ? { kind: "image", src: p.artworkUrl, fit: "contain", tone: "alt", card: true } : null,
        p.mockupUrl ? { kind: "image", src: p.mockupUrl, fit: "cover", tone: "alt" } : null,
      ]
    : [
        p.mockupUrl ? { kind: "image", src: p.mockupUrl, fit: "cover", tone: "white" } : null,
        p.artworkUrl ? { kind: "image", src: p.artworkUrl, fit: "contain", tone: "alt", card: true } : null,
      ];
  return [...slides.filter((s): s is GallerySlide => s !== null), { kind: "tag", text: fmt(m.product.tagSlide, { name: p.creator.displayName }) }];
}

/**
 * Product page v3 (board 2019:2004). DOM order = reading order: breadcrumb (Shop is the back link) →
 * gallery → eyebrow → h1 → maker row → price → Size → Quantity + Add to bag (→ checkout sheet) →
 * pays-the-artist note → Meet the maker → disclosures → More from {name}. Two columns from 64rem.
 */
export function ProductView({ product: p, more = [] }: { product: ProductDetail; more?: ShopProduct[] }) {
  const typeLabel = p.type === "sticker" ? m.common.sticker : m.common.tote;
  const alt = p.altText ?? fmt(m.product.mockupAlt, { title: p.title, type: typeLabel });
  const action = placeOrder.bind(null, p.id);
  const byLine = fmt(m.common.by, { name: p.creator.displayName });
  const makerLine = [p.creator.studioName, m.product.makerMethod].filter(Boolean).join(m.common.listSeparator);
  return (
    <div className={styles.page}>
      <nav aria-label={m.product.breadcrumbLabel}>
        <ol role="list" className={styles.breadcrumb}>
          <li><Link href="/" className={styles.back}><ChevronLeftIcon size="1.25rem" />{m.product.breadcrumbShop}</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href={`/?type=${p.type}#collection`} className={styles.crumb}>{p.type === "sticker" ? m.product.breadcrumbStickers : m.product.breadcrumbTotes}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className={styles.crumbCurrent}>{p.title}</li>
        </ol>
      </nav>
      <div className={styles.layout}>
        <Gallery slides={gallerySlides(p)} alt={alt} />
        <div className={styles.details}>
          <Eyebrow tone="accent">{p.type === "sticker" ? m.product.eyebrowSticker : m.product.eyebrowTote}</Eyebrow>
          <Display as="h1" size="xl">{p.title}</Display>
          <div className={styles.makerRow}>
            <Avatar name={p.creator.displayName} src={p.creator.avatarUrl} size="s" tone="deep" />
            <div className={styles.makerRowText}>
              {/* Hidden (testing) creators have no public profile; their product still opens by direct link. */}
              {p.creator.hidden
                ? <p className={styles.by}>{byLine}</p>
                : <p className={styles.by}><Link href={`/c/${p.creator.slug}`} className={styles.byLink}>{byLine}</Link></p>}
              <p className={styles.makerLine}>{makerLine}</p>
            </div>
            {p.creator.isExample ? <Chip tone="cream">{m.common.example}</Chip> : null}
          </div>
          <ProductBuy action={action} type={p.type} title={p.title} priceCents={p.priceCents} />
          <PaysArtistNote name={p.creator.displayName} type={p.type} />
          <MeetMakerCard product={p} />
          <Disclosures product={p} />
        </div>
      </div>
      <MoreFrom creator={p.creator} products={more.filter((x) => x.id !== p.id)} />
    </div>
  );
}
