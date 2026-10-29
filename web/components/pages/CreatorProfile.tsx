import type { CreatorProfile as CreatorProfileData } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { Avatar } from "@/components/site/Avatar";
import { ProductCard } from "@/components/site/ProductCard";
import { ReadAloud } from "@/components/site/ReadAloud";
import { StoryVideo } from "@/components/site/StoryVideo";
import { Card } from "@/components/ui/Card";
import { Display } from "@/components/ui/Display";
import { Grid, Stack } from "@/components/ui/Layout";
import { Chip, Title } from "@/components/ui/Text";
import { EmptyNote } from "./EmptyNote";
import styles from "./Pages.module.css";

export function CreatorProfile({ creator: c }: { creator: CreatorProfileData }) {
  const story = c.storyText ?? c.bioShort ?? "";
  return (
    <Stack gap="section">
      <header className={styles.profileHead}>
        <Avatar name={c.displayName} src={c.avatarUrl} size="l" />
        <div className={styles.profileTitle}>
          <Display as="h1" size="xl">{c.displayName}</Display>
          {c.studioName ? <p className={styles.studio}>{c.studioName}</p> : null}
          {c.isExample ? <Chip tone="cream">{m.common.example}</Chip> : null}
        </div>
      </header>
      <Card pad="l" className={styles.profileCard}>
        <div className={styles.profileVideo}><StoryVideo creator={c} /></div>
        <Stack gap="m">
          <Title>{m.creator.storyTitle}</Title>
          {story ? <p>{story}</p> : null}
          {story ? <div><ReadAloud text={story} label={m.common.readAloud} stopLabel={m.common.stopReading} unsupportedLabel={m.common.speechUnsupported} /></div> : null}
          {c.isExample ? <p className={styles.note}>{m.common.exampleNote}</p> : null}
        </Stack>
      </Card>
      <section aria-labelledby="work-title">
        <Stack gap="xxl">
          <Display id="work-title" size="l">{fmt(m.creator.productsTitle, { name: c.displayName })}</Display>
          {c.products.length === 0
            ? <EmptyNote>{m.creator.noProducts}</EmptyNote>
            : <Grid cols={3}>{c.products.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}</Grid>}
        </Stack>
      </section>
    </Stack>
  );
}
