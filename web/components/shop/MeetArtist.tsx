import Link from "next/link";
import type { PublicCreator } from "@/lib/db/queries.contract";
import { listMakers } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { initials } from "@/components/site/Avatar";
import { Display } from "@/components/ui/Display";
import { PlayIcon } from "@/components/ui/Icons";
import { Chip } from "@/components/ui/Text";
import styles from "./Shop.module.css";

const POSTER_TONES = ["soft", "accent", "alt"] as const;

/** Meet the makers header row (4010:4406): h2 + subhead, "All makers →" to /artists. */
export function MakersHeader() {
  return (
    <div className={styles.headerRow}>
      <div className={styles.headerText}>
        <Display id="makers-title" size="l">{m.shop.makersTitle}</Display>
        <p className={styles.headerCopy}>{m.shop.makersCopy}</p>
      </div>
      <Link href="/artists" className={styles.textAction}>{m.shop.allMakers}<span aria-hidden="true"> →</span></Link>
    </div>
  );
}

/** Three maker cards (4010:4411). */
export async function MeetMakers() {
  const makers = await listMakers(3);
  if (makers.length === 0) return <p className={styles.meetEmpty}>{m.shop.makersEmpty}</p>;
  return (
    <ul role="list" className={styles.makers}>
      {makers.map((c, i) => <li key={c.id}><MakerCard creator={c} tone={POSTER_TONES[i % POSTER_TONES.length]} /></li>)}
    </ul>
  );
}

/**
 * Maker card (4010:4412): story poster (initials, "WATCH STORY", play circle), name, studio (no method chip until a creator field backs it; the board's chips are sample data).
 * The poster is the link to the maker's page, where the story video plays with captions; its name starts
 * with the visible "Watch story" and adds the maker ("Watch story, Leo"). The initials avatar is decorative.
 */
export function MakerCard({ creator: c, tone = "soft" }: { creator: Pick<PublicCreator, "slug" | "displayName" | "studioName" | "isExample">; tone?: (typeof POSTER_TONES)[number] }) {
  return (
    <article className={styles.maker}>
      <Link href={`/c/${c.slug}`} className={[styles.poster, styles[`tone_${tone}`]].join(" ")}>
        <span className={styles.posterAvatar} aria-hidden="true">{initials(c.displayName)}</span>
        <span className={styles.posterLabel}>{m.shop.watchStory}<span className="visually-hidden">{fmt(m.shop.watchStoryName, { name: c.displayName })}</span></span>
        <span className={styles.playCircle} aria-hidden="true"><PlayIcon size="1.25rem" /></span>
      </Link>
      <div className={styles.makerInfo}>
        <h3 className={styles.makerName}>{c.displayName}</h3>
        {c.studioName ? <p className={styles.makerStudio}>{c.studioName}</p> : null}
      </div>
      {c.isExample ? <div className={styles.makerChips}><Chip tone="cream">{m.common.example}</Chip></div> : null}
    </article>
  );
}
