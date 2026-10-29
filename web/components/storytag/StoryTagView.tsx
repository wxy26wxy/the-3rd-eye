import type { StoryTagView as StoryTagData } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { sendReply, tap } from "@/app/t/[token]/actions";
import { ProductCard } from "@/components/site/ProductCard";
import { ReadAloud } from "@/components/site/ReadAloud";
import { ShareButton } from "@/components/site/ShareButton";
import { StoryVideo } from "@/components/site/StoryVideo";
import { Card } from "@/components/ui/Card";
import { Display } from "@/components/ui/Display";
import { Grid, Stack } from "@/components/ui/Layout";
import { Sheet } from "@/components/ui/Sheet";
import { Chip, Eyebrow, Title } from "@/components/ui/Text";
import { FollowButton } from "./FollowButton";
import { NoteForm } from "./NoteForm";
import { TapOnce } from "./TapOnce";
import { ThankYou } from "./ThankYou";
import { Thread } from "./Thread";
import styles from "./StoryTag.module.css";

export function StoryTagView({ view }: { view: StoryTagData }) {
  const c = view.creator;
  const bio = c.storyText ?? c.bioShort ?? "";
  const studio = c.studioName ?? m.common.brand;
  return (
    <>
      <TapOnce token={view.token} onTap={tap} />
      <div className={styles.top}>
        <Stack gap="m">
          <Eyebrow>{m.tag.eyebrow}</Eyebrow>
          <p className={styles.who}>{c.displayName} · {studio}</p>
          <Display as="h1" size="xl">{fmt(m.tag.hi, { name: c.displayName })}</Display>
          {c.isExample ? <div><Chip tone="cream">{m.common.example}</Chip></div> : null}
        </Stack>
        <div className={styles.video}><StoryVideo creator={c} tagToken={view.token} /></div>
        <ReadAloud block variant="primary" text={fmt(m.tag.readAloudText, { name: c.displayName, bio })} label={m.common.readAloud} stopLabel={m.common.stopReading} unsupportedLabel={m.common.speechUnsupported} />
        <div className={styles.actions}>
          <FollowButton creatorId={c.id} label={m.tag.follow} followingLabel={m.tag.following} note={m.tag.followNote} />
          <ShareButton label={m.tag.share} title={c.displayName} text={fmt(m.tag.shareText, { name: c.displayName, title: view.productTitle })} copiedLabel={m.common.linkCopied} />
        </div>
      </div>
      <Sheet labelledBy="about-title" className={styles.sheet}>
        <Stack gap="xxl">
          <ThankYou thankYou={view.thankYou} token={view.token} name={c.displayName} />
          <Thread messages={view.messages} name={c.displayName} />
          <Card pad="l" tone="white">
            <Stack gap="m">
              <Title>{m.tag.noteTitle}</Title>
              <NoteForm action={sendReply.bind(null, view.token)} name={c.displayName} />
            </Stack>
          </Card>
          {bio ? (
            <Stack gap="s">
              <Title id="about-title">{m.tag.aboutTitle}</Title>
              <p>{bio}</p>
            </Stack>
          ) : <h2 id="about-title" className="visually-hidden">{m.tag.aboutTitle}</h2>}
          {view.moreFromStudio.length > 0 ? (
            <section aria-labelledby="more-title">
              <Stack gap="l">
                <Title id="more-title">{fmt(m.tag.moreFrom, { studio })}</Title>
                <Grid cols={2}>{view.moreFromStudio.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}</Grid>
              </Stack>
            </section>
          ) : null}
        </Stack>
      </Sheet>
    </>
  );
}
