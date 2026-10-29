import { notFound } from "next/navigation";
import { getProductDetail } from "@/lib/db/queries.contract";
import { fmt, m, money, sharePercent } from "@/components/messages";
import { placeOrder } from "@/app/(site)/p/[id]/actions";
import { DieCut } from "@/components/site/DieCut";
import { StoryVideo } from "@/components/site/StoryVideo";
import { Avatar } from "@/components/site/Avatar";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Display } from "@/components/ui/Display";
import { Chip } from "@/components/ui/Text";
import { BuyForm } from "./BuyForm";
import styles from "./Product.module.css";

export async function ProductView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProductDetail(id);
  if (!p) notFound();
  const typeLabel = p.type === "sticker" ? m.common.sticker : m.common.tote;
  const alt = p.altText ?? fmt(m.product.mockupAlt, { title: p.title, type: typeLabel });
  const action = placeOrder.bind(null, p.id);
  return (
    <>
      <div className={styles.layout}>
        <div className={styles.media}>
          <Card pad="s"><ArtImage src={p.mockupUrl ?? p.artworkUrl} alt={alt} eager placeholder={m.common.imageMissing} /></Card>
          {p.type === "sticker" ? <DieCut artworkUrl={p.artworkUrl} cutPathSvg={p.cutPathSvg} alt={alt} /> : null}
        </div>
        <div className={styles.info}>
          <div className={styles.chips}>
            <Chip tone="cream">{typeLabel}</Chip>
            {p.madeByVoice ? <Chip>{m.common.madeByVoice}</Chip> : null}
          </div>
          <Display as="h1" size="l">{p.title}</Display>
          <p className={styles.by}>{fmt(m.common.by, { name: p.creator.displayName })}</p>
          <p className={styles.price}>{money(p.priceCents)}</p>
          <p className={styles.share}><Chip>{fmt(m.product.artistShare, { percent: sharePercent(p.creator.split?.creator_bps) })}</Chip></p>
          {p.description ? <p className={styles.desc}>{p.description}</p> : null}
          <Card pad="l"><BuyForm action={action} priceLabel={fmt(m.product.buySubmit, { price: money(p.priceCents) })} /></Card>
        </div>
      </div>
      <section aria-labelledby="story-title" className={styles.story}>
        <Display id="story-title" size="l">{m.product.storyTitle}</Display>
        <Card pad="l" className={styles.storyCard}>
          <div className={styles.storyVideo}><StoryVideo creator={p.creator} /></div>
          <div className={styles.storyText}>
            <div className={styles.creatorRow}>
              <Avatar name={p.creator.displayName} src={p.creator.avatarUrl} />
              <div>
                <p className={styles.creatorName}>{p.creator.displayName}</p>
                {p.creator.studioName ? <p className={styles.studio}>{p.creator.studioName}</p> : null}
              </div>
            </div>
            {p.creator.isExample ? <Chip tone="cream">{m.common.example}</Chip> : null}
            {p.creator.storyText ?? p.creator.bioShort ? <p>{p.creator.storyText ?? p.creator.bioShort}</p> : null}
            <Button href={`/c/${p.creator.slug}`}>{fmt(m.product.seeWork, { name: p.creator.displayName })}</Button>
          </div>
        </Card>
      </section>
    </>
  );
}
