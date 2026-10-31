import { Suspense } from "react";
import type { Metadata } from "next";
import { listPublicCreators } from "@/lib/db/queries.contract";
import { m } from "@/components/messages";
import { CreatorCard } from "@/components/site/CreatorCard";
import { Display } from "@/components/ui/Display";
import { Container } from "@/components/ui/Layout";
import { Loading } from "@/components/ui/Loading";
import { EmptyNote } from "@/components/pages/EmptyNote";
import styles from "@/components/pages/Pages.module.css";

export const metadata: Metadata = { title: m.artists.metaTitle };

async function CreatorGrid() {
  const creators = await listPublicCreators();
  if (creators.length === 0) return <EmptyNote>{m.artists.empty}</EmptyNote>;
  return <ul role="list" className={styles.cards}>{creators.map((c) => <li key={c.id}><CreatorCard creator={c} /></li>)}</ul>;
}

/** Artists · Sky (boards 2024:2597, empty 2024:2652). */
export default function ArtistsPage() {
  return (
    <Container className={styles.page}>
      <Display as="h1" size="web">{m.artists.title}</Display>
      <p className={styles.lead}>{m.artists.copy}</p>
      <Suspense fallback={<Loading label={m.common.loading} />}><CreatorGrid /></Suspense>
    </Container>
  );
}
