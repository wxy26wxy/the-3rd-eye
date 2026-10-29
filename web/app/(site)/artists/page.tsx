import { Suspense } from "react";
import type { Metadata } from "next";
import { listPublicCreators } from "@/lib/db/queries.contract";
import { m } from "@/components/messages";
import { CreatorCard } from "@/components/site/CreatorCard";
import { Display } from "@/components/ui/Display";
import { Container, Grid, Section, Stack } from "@/components/ui/Layout";
import { Loading } from "@/components/ui/Loading";
import { Lead } from "@/components/ui/Text";
import { EmptyNote } from "@/components/pages/EmptyNote";

export const metadata: Metadata = { title: m.artists.metaTitle };

async function CreatorGrid() {
  const creators = await listPublicCreators();
  if (creators.length === 0) return <EmptyNote>{m.artists.empty}</EmptyNote>;
  return <Grid cols={3}>{creators.map((c) => <li key={c.id}><CreatorCard creator={c} /></li>)}</Grid>;
}

export default function ArtistsPage() {
  return (
    <Container>
      <Section>
        <Stack gap="xxl">
          <Display as="h1" size="xl">{m.artists.title}</Display>
          <Lead>{m.artists.copy}</Lead>
          <Suspense fallback={<Loading label={m.common.loading} />}><CreatorGrid /></Suspense>
        </Stack>
      </Section>
    </Container>
  );
}
