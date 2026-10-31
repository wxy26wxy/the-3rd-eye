import type { StoryTagView as StoryTagData } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { sendReply, tap } from "@/app/t/[token]/actions";
import { ProductCard } from "@/components/site/ProductCard";
import { ReadAloud } from "@/components/site/ReadAloud";
import { ShareButton } from "@/components/site/ShareButton";
import { StoryVideo } from "@/components/site/StoryVideo";
import { Display } from "@/components/ui/Display";
import { Chip, Eyebrow } from "@/components/ui/Text";
import { FollowButton } from "./FollowButton";
import { NoteForm } from "./NoteForm";
import { TapOnce } from "./TapOnce";
import { ThankYou } from "./ThankYou";
import { Thread } from "./Thread";
import styles from "./StoryTag.module.css";

/**
 * Story tag · Sky (board 2024:2428). Order: STORY TAG → name · studio → h1 → video (captions) →
 * Read aloud (secondary) → Follow, Share → grey sheet: thank-you card → Your notes → Send a note
 * (the one primary) → About me → More from studio.
 */
export function StoryTagView({ view }: { view: StoryTagData }) {
  const c = view.creator;
  const bio = c.storyText ?? c.bioShort ?? "";
  const studio = c.studioName ?? m.common.brand;
  return (
    <>
      <TapOnce token={view.token} onTap={tap} />
      <div className={styles.top}>
        <Eyebrow tone="muted">{m.tag.eyebrow}</Eyebrow>
        <p className={styles.who}>{c.displayName} · {studio}</p>
        <Display as="h1" size="xl">{fmt(m.tag.hi, { name: c.displayName })}</Display>
        {c.isExample ? <div><Chip tone="cream">{m.common.example}</Chip></div> : null}
        <StoryVideo creator={c} tagToken={view.token} className={styles.video} />
        <ReadAloud block text={fmt(m.tag.readAloudText, { name: c.displayName, bio })} label={m.common.readAloud} stopLabel={m.common.stopReading} unsupportedLabel={m.common.speechUnsupported} />
        <div className={styles.actions}>
          <FollowButton creatorId={c.id} label={m.tag.follow} followingLabel={m.tag.following} note={m.tag.followNote} />
          <ShareButton label={m.tag.share} title={c.displayName} text={fmt(m.tag.shareText, { name: c.displayName, title: view.productTitle })} copiedLabel={m.common.linkCopied} />
        </div>
      </div>
      <div className={styles.sheet}>
        <ThankYou thankYou={view.thankYou} token={view.token} name={c.displayName} />
        <Thread messages={view.messages} name={c.displayName} />
        <section aria-labelledby="note-title" className={styles.noteCard}>
          <h2 id="note-title" className={styles.noteTitle}>{m.tag.noteTitle}</h2>
          <NoteForm action={sendReply.bind(null, view.token)} name={c.displayName} />
        </section>
        <section aria-labelledby="about-title" className={styles.block}>
          <h2 id="about-title" className={bio ? styles.h2 : "visually-hidden"}>{m.tag.aboutTitle}</h2>
          {bio ? <p className={styles.bio}>{bio}</p> : null}
        </section>
        {view.moreFromStudio.length > 0 ? (
          <section aria-labelledby="more-title" className={styles.block}>
            <h2 id="more-title" className={styles.h2}>{fmt(m.tag.moreFrom, { studio })}</h2>
            <ul role="list" className={styles.more}>{view.moreFromStudio.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}</ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
