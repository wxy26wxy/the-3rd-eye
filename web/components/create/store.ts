"use client";
/**
 * Creator-flow draft, kept in sessionStorage so a refresh or a back/forward does not lose
 * work. Exposed through useSyncExternalStore; the server snapshot has `ready: false` so
 * screens can wait for hydration instead of flashing "missing" states.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { AppliedCutout, ImageSize } from "./cutout";
import { api, type AgentStep, type ArtworkVariant, type Candidate, type Creator, type ListingDraft, type Product, type ProductType, type ShapeResult } from "./api";

export type Draft = {
  product?: ProductType;
  method?: "photo" | "upload" | "voice";
  transcript?: string;
  answers?: string[];
  shaped?: ShapeResult;
  variants?: ArtworkVariant[];
  artworkId?: string;
  photoArtworkId?: string;
  candidates?: Candidate[];
  /** Pixels of the stored original for `photoArtworkId` (the space of `Candidate.bbox`). */
  imageSize?: ImageSize | null;
  /** The cut saved by "Apply cutout" on Select for `photoArtworkId` (survives a reload). */
  appliedCutout?: AppliedCutout;
  /** Product trouble reported by the last cleanup, shown on Ready. */
  cutoutNotice?: string;
  productRecord?: Product;
  listing?: ListingDraft;
  trace?: AgentStep[];
  listingTitle?: string;
  storyVideoNeeded?: boolean;
};
type State = { ready: boolean; draft: Draft; creator: Creator | null };

const KEY = "ms:create";
const SERVER: State = { ready: false, draft: {}, creator: null };
let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (state) return state;
  let draft: Draft = {};
  let creator: Creator | null = null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) ({ draft = {}, creator = null } = JSON.parse(raw) as Partial<State>);
  } catch { /* storage blocked */ }
  state = { ready: true, draft, creator };
  return state;
}
function save(next: State) {
  state = next;
  try { sessionStorage.setItem(KEY, JSON.stringify({ draft: next.draft, creator: next.creator })); } catch { /* storage blocked */ }
  listeners.forEach((l) => l());
}
function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

export function updateDraft(patch: Partial<Draft>) { const s = load(); save({ ...s, draft: { ...s.draft, ...patch } }); }
/** Start a new piece; keeps the signed-in creator. */
export function resetDraft(keep: Partial<Draft> = {}) { const s = load(); save({ ...s, draft: { ...keep } }); }
function setCreator(c: Creator | null) { const s = load(); save({ ...s, creator: c }); }

export function useCreate() {
  const s = useSyncExternalStore(subscribe, load, () => SERVER);
  return { ready: s.ready, draft: s.draft, creator: s.creator, update: updateDraft, reset: resetDraft };
}

let creatorRequest: Promise<Creator | null> | null = null;
/** Loads /creators/me once per session (needed for upload paths and the earnings line). */
export function useCreator() {
  const { ready, creator } = useCreate();
  const refresh = useCallback(() => {
    creatorRequest = api<Creator>("creators/me")
      .then((c) => { setCreator(c); return c; })
      .catch(() => { creatorRequest = null; return null; });
    return creatorRequest;
  }, []);
  useEffect(() => {
    if (ready && !creator && !creatorRequest) void refresh();
  }, [ready, creator, refresh]);
  return { creator, refresh };
}

/** In-flight requests keyed by purpose, so remounts (Strict Mode, back/forward) never double-submit. */
const inflight = new Map<string, Promise<unknown>>();
export function once<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = run().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** POST /products for the chosen artwork and remember it. */
export async function makeProduct(artworkId: string, type: ProductType): Promise<Product> {
  const product = await once(`product:${artworkId}:${type}`, () => api<Product>("products", { json: { artworkId, type } }));
  updateDraft({ productRecord: product, artworkId, listing: undefined, trace: undefined });
  return product;
}
