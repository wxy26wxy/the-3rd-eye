import Link from "next/link";
import type { CreatorSummary } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { Chip } from "@/components/ui/Text";
import { Avatar } from "./Avatar";
import styles from "./CreatorCard.module.css";

/** Creator card (board 2024:2616): 80 px avatar, name, studio, "Meet {name}" link; the whole card is the link's target. */
export function CreatorCard({ creator }: { creator: CreatorSummary }) {
  return (
    <article className={styles.card}>
      <Avatar name={creator.displayName} src={creator.avatarUrl} size="xl" />
      <h2 className={styles.name}>{creator.displayName}</h2>
      {creator.studioName ? <p className={styles.studio}>{creator.studioName}</p> : null}
      {creator.isExample ? <Chip tone="cream">{m.common.example}</Chip> : null}
      <Link href={`/c/${creator.slug}`} className={styles.link}>{fmt(m.artists.viewProfile, { name: creator.displayName })}</Link>
    </article>
  );
}
