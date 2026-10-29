import { Suspense } from "react";
import type { Metadata } from "next";
import { getCreatorProfile } from "@/lib/db/queries.contract";
import { m } from "@/components/messages";
import { CreatorProfile } from "@/components/pages/CreatorProfile";
import { Container, Section } from "@/components/ui/Layout";
import { Loading } from "@/components/ui/Loading";

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const c = await getCreatorProfile((await params).slug);
  return { title: c?.displayName ?? m.artists.metaTitle, description: c?.bioShort ?? undefined };
}

export default function CreatorPage({ params }: PageProps<"/c/[slug]">) {
  return (
    <Container>
      <Section>
        <Suspense fallback={<Loading label={m.common.loading} />}>
          <CreatorProfile params={params} />
        </Suspense>
      </Section>
    </Container>
  );
}
