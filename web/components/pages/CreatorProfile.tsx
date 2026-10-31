import type { CreatorProfile as CreatorProfileData } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { ProductGrid } from "@/components/shop/Collection";
import { Avatar } from "@/components/site/Avatar";
import { ProductCard } from "@/components/site/ProductCard";
import { ReadAloud } from "@/components/site/ReadAloud";
import { StoryVideo } from "@/components/site/StoryVideo";
import { Display } from "@/components/ui/Display";
import { Chip } from "@/components/ui/Text";
import { EmptyNote } from "./EmptyNote";
import styles from "./Pages.module.css";

/** Artist profile · Sky (board 2024:2688): header with the avatar, In their own words + Read aloud beside the story video, Work by grid. */
export function CreatorProfile({ creator: c }: { creator: CreatorProfileData }) {
  const story = c.storyText ?? c.bioShort ?? "";
  return (
    <div className={styles.profile}>
      <header className={styles.profileHead}>
        <Avatar name={c.displayName} src={c.avatarUrl} size="xxl" />
        <div className={styles.profileTitle}>
          <Display as="h1" size="web">{c.displayName}</Display>
          {c.studioName ? <p className={styles.studio}>{c.studioName}</p> : null}
          {c.isExample ? <Chip tone="cream">{m.common.example}</Chip> : null}
        </div>
      </header>
      <div className={styles.storyRow}>
        <section aria-labelledby="own-words" className={styles.ownWords}>
          <Display as="h2" id="own-words" size="l">{m.creator.storyTitle}</Display>
          {story ? <p className={styles.storyText}>{story}</p> : null}
          {story ? <div><ReadAloud text={story} label={m.common.readAloud} stopLabel={m.common.stopReading} unsupportedLabel={m.common.speechUnsupported} /></div> : null}
          {c.isExample ? <p className={styles.note}>{m.common.exampleNote}</p> : null}
        </section>
        <StoryVideo creator={c} className={styles.profileVideo} />
      </div>
      <section aria-labelledby="work-title" className={styles.work}>
        <Display id="work-title" size="l">{fmt(m.creator.productsTitle, { name: c.displayName })}</Display>
        {c.products.length === 0
          ? <EmptyNote>{m.creator.noProducts}</EmptyNote>
          : <ProductGrid>{c.products.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}</ProductGrid>}
      </section>
    </div>
  );
}
