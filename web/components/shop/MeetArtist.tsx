import { getFeaturedCreator } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { StoryVideo } from "@/components/site/StoryVideo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Display } from "@/components/ui/Display";
import { Chip } from "@/components/ui/Text";
import styles from "./Shop.module.css";

export async function MeetArtist() {
  const creator = await getFeaturedCreator();
  if (!creator) return <p className={styles.empty}>{m.shop.meetEmpty}</p>;
  return (
    <Card pad="l" className={styles.meet}>
      <div className={styles.meetVideo}><StoryVideo creator={creator} /></div>
      <div className={styles.meetText}>
        <Display as="h3" size="l" tone="onCream">{creator.displayName}</Display>
        {creator.studioName ? <p className={styles.meetStudio}>{creator.studioName}</p> : null}
        {creator.isExample ? <Chip tone="cream">{m.common.example}</Chip> : null}
        {creator.bioShort ? <p>{creator.bioShort}</p> : null}
        <Button href={`/c/${creator.slug}`}>{fmt(m.shop.meetCta, { name: creator.displayName })}</Button>
      </div>
    </Card>
  );
}
