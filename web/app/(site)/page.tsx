import { Suspense } from "react";
import { m } from "@/components/messages";
import { Collection, CollectionFallback } from "@/components/shop/Collection";
import { Hero } from "@/components/shop/Hero";
import { HowSteps } from "@/components/shop/HowSteps";
import { MeetArtist } from "@/components/shop/MeetArtist";
import { Display } from "@/components/ui/Display";
import { Container } from "@/components/ui/Layout";
import { Loading } from "@/components/ui/Loading";
import styles from "@/components/shop/Shop.module.css";

/** Shop · Sky (boards 2018:1789 / 2018:1970): hero → collection → how a story tag works (grey band) → meet the artist. */
export default function ShopPage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <Hero />
      <section id="collection" aria-labelledby="collection-title" className={styles.band}>
        <Container className={styles.bandStack}>
          <Display id="collection-title" size="l">{m.shop.collectionTitle}</Display>
          <Suspense fallback={<CollectionFallback />}>
            <Collection searchParams={searchParams} />
          </Suspense>
        </Container>
      </section>
      <div className={[styles.band, styles.bandAlt].join(" ")}>
        <Container>
          <HowSteps />
        </Container>
      </div>
      <section aria-labelledby="meet-title" className={styles.band}>
        <Container className={styles.bandStack}>
          <Display id="meet-title" size="l">{m.shop.meetTitle}</Display>
          <Suspense fallback={<Loading label={m.common.loading} />}>
            <MeetArtist />
          </Suspense>
        </Container>
      </section>
    </>
  );
}
