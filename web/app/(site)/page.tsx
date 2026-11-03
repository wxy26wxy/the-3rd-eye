import { Suspense } from "react";
import { loadCreatorProfile, loadDemoStoryTagHref, loadFeaturedCreator } from "@/components/data";
import { m } from "@/components/messages";
import { Collection, CollectionFallback } from "@/components/shop/Collection";
import { Hero, HeroChip } from "@/components/shop/Hero";
import { HowSteps, PhonePreview, STORY_TAG_FALLBACK, StoryTagCta } from "@/components/shop/HowSteps";
import { MakersHeader, MeetMakers } from "@/components/shop/MeetArtist";
import { Container } from "@/components/ui/Layout";
import styles from "@/components/shop/Shop.module.css";

async function FeaturedChip() {
  return <HeroChip creator={await loadFeaturedCreator()} />;
}

/** The phone preview shows the featured creator and their newest piece. */
async function FeaturedPreview() {
  const c = await loadFeaturedCreator();
  const first = c && !c.hidden ? (await loadCreatorProfile(c.slug))?.products[0] : undefined;
  return (
    <PhonePreview
      name={c?.displayName ?? null}
      studio={c?.studioName ?? null}
      bio={c?.storyText ?? c?.bioShort ?? null}
      product={first ? { title: first.title, imageUrl: (first.type === "sticker" ? first.previewUrl ?? first.artworkUrl : first.mockupUrl ?? first.artworkUrl) ?? first.mockupUrl, type: first.type } : null}
    />
  );
}

/** "See a story tag in action" → a live example story tag when one exists (T128). */
async function DemoTagCta() {
  return <StoryTagCta href={await loadDemoStoryTagHref()} />;
}

/**
 * Shop · Sky v3 (board 2018:1789): hero → filters and New this week → story tags band → Meet the makers.
 * Phones stack the same sections (the 390 board 2018:1970 still shows the v2 layout).
 */
export default function ShopPage({ searchParams }: PageProps<"/">) {
  return (
    <Container className={styles.shop}>
      <Hero chip={<Suspense fallback={<HeroChip creator={null} />}><FeaturedChip /></Suspense>} />
      <section id="collection" aria-labelledby="collection-title" className={styles.collection} tabIndex={-1}>
        <Suspense fallback={<CollectionFallback />}>
          <Collection searchParams={searchParams} />
        </Suspense>
      </section>
      <HowSteps preview={<Suspense fallback={<PhonePreview name={null} studio={null} bio={null} product={null} />}><FeaturedPreview /></Suspense>}
        cta={<Suspense fallback={<StoryTagCta href={STORY_TAG_FALLBACK} />}><DemoTagCta /></Suspense>} />
      <section aria-labelledby="makers-title" className={styles.makersSection}>
        <MakersHeader />
        <Suspense fallback={<p role="status">{m.common.loading}</p>}>
          <MeetMakers />
        </Suspense>
      </section>
    </Container>
  );
}
