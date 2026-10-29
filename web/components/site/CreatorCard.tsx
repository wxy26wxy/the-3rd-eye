import Link from "next/link";
import type { CreatorSummary } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { Chip } from "@/components/ui/Text";
import { Avatar } from "./Avatar";
import styles from "./CreatorCard.module.css";

export function CreatorCard({ creator }: { creator: CreatorSummary }) {
  return (
    <article className={styles.card}>
      <Avatar name={creator.displayName} src={creator.avatarUrl} size="l" />
      <div className={styles.body}>
        <h2 className={styles.name}>
          <Link href={`/c/${creator.slug}`} className={styles.link} aria-label={fmt(m.artists.viewProfile, { name: creator.displayName })}>{creator.displayName}</Link>
        </h2>
        {creator.studioName ? <p className={styles.studio}>{creator.studioName}</p> : null}
        {creator.bioShort ? <p>{creator.bioShort}</p> : null}
        {creator.isExample ? <Chip tone="cream">{m.common.example}</Chip> : null}
      </div>
    </article>
  );
}
