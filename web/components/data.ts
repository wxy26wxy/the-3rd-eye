import "server-only";
import { cache } from "react";
import { getCreatorProfile, getProductDetail, getStoryTag } from "@/lib/db/queries.contract";

/** Per-request memoized loaders, so generateMetadata and the page share one query. */
export const loadProduct = cache(getProductDetail);
export const loadCreatorProfile = cache(getCreatorProfile);
export const loadStoryTag = cache(getStoryTag);
