import "server-only";
import { cache } from "react";
import { getCreatorProfile, getDemoStoryTagHref, getFeaturedCreator, getProductDetail, getStoryTag } from "@/lib/db/queries.contract";

/** Per-request memoized loaders, so generateMetadata and the page share one query. */
export const loadProduct = cache(getProductDetail);
export const loadCreatorProfile = cache(getCreatorProfile);
export const loadStoryTag = cache(getStoryTag);
/** The shop hero chip and the story-tag phone preview both show the featured creator. */
export const loadFeaturedCreator = cache(getFeaturedCreator);
/** "See a story tag in action": a live example story tag, or How it works. */
export const loadDemoStoryTagHref = cache(getDemoStoryTagHref);
