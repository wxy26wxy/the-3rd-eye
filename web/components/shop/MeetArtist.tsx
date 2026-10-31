import { getFeaturedCreator } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { StoryVideo } from "@/components/site/StoryVideo";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Chip } from "@/components/ui/Text";
import styles from "./Shop.module.css";

/** Meet the artist card (board 2018:1939): story video poster left, name · studio, short bio, story, primary link. */
export async function MeetArtist() {
  const creator = await getFeaturedCreator();
  if (!creator) return <p className={styles.meetEmpty}>{m.shop.meetEmpty}</p>;
  const story = creator.storyText && creator.storyText !== creator.bioShort ? creator.storyText : null;
  return (
    <div className={styles.meet}>
      <div className={styles.meetVideo}><StoryVideo creator={creator} /></div>
      <div className={styles.meetText}>
        <Eyebrow as="h3" tone="muted">{creator.studioName ? `${creator.displayName} · ${creator.studioName}` : creator.displayName}</Eyebrow>
        {creator.isExample ? <Chip tone="cream">{m.common.example}</Chip> : null}
        {creator.bioShort ? <p className={styles.meetLead}>{creator.bioShort}</p> : null}
        {story ? <p className={styles.meetStory}>{story}</p> : null}
        <Button href={`/c/${creator.slug}`} className={styles.meetCta}>{fmt(m.shop.meetCta, { name: creator.displayName })}</Button>
      </div>
    </div>
  );
}
