import { Suspense } from "react";
import { m } from "@/components/messages";
import { Collection, CollectionFallback } from "@/components/shop/Collection";
import { Hero } from "@/components/shop/Hero";
import { HowSteps } from "@/components/shop/HowSteps";
import { MeetArtist } from "@/components/shop/MeetArtist";
import { Display } from "@/components/ui/Display";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Loading } from "@/components/ui/Loading";

export default function ShopPage({ searchParams }: PageProps<"/">) {
  return (
    <Container>
      <Hero />
      <Section id="collection" labelledBy="collection-title">
        <Stack gap="xxl">
          <Display id="collection-title" size="l">{m.shop.collectionTitle}</Display>
          <Suspense fallback={<CollectionFallback />}>
            <Collection searchParams={searchParams} />
          </Suspense>
        </Stack>
      </Section>
      <Section>
        <HowSteps />
      </Section>
      <Section labelledBy="meet-title">
        <Stack gap="xxl">
          <Display id="meet-title" size="l">{m.shop.meetTitle}</Display>
          <Suspense fallback={<Loading label={m.common.loading} />}>
            <MeetArtist />
          </Suspense>
        </Stack>
      </Section>
    </Container>
  );
}
