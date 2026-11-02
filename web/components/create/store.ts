"use client";
/**
 * Creator-flow draft, kept in sessionStorage so a refresh or a back/forward does not lose
 * work, and tied to the current sign-in (`ms_creator_session`), so another creator never sees it.
 * Exposed through useSyncExternalStore; the server snapshot has `ready: false` so screens can wait
 * for hydration instead of flashing "missing" states.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Box, ImageSize } from "./cutout";
import { CREATOR_SESSION_COOKIE } from "./constants";
import { api, type AgentStep, type Candidate, type Creator, type ListingDraft, type Product, type ProductType } from "./api";

/** One "Change it" result: a child artwork of the piece (or of the previous change). */
export type ChangeStep = {
  artworkId: string;
  /** The row it was made from: the piece, or the previous change ("Change it again"). */
  parentId: string;
  instruction: string;
  transcript?: string;
  /** Public URL of the edited picture (shown on Before and after). */
  previewUrl: string | null;
  alt: string | null;
  spoken: string | null;
  differences: string;
};

/** The artwork whose cut-out "Your cutout" shows, with its SAM pieces. */
export type CutoutState = {
  artworkId: string;
  candidates: Candidate[];
  imageSize: ImageSize | null;
  /** The pieces in the current cut (the picked piece, or the largest one after `cutout`). */
  selectedIds: string[];
  cleanedUrl: string | null;
  altText: string | null;
};

export type Draft = {
  product?: ProductType;
  method?: "photo" | "upload";
  /** The photo artwork (POST /artworks) and its SAM pieces. */
  photoArtworkId?: string;
  candidates?: Candidate[];
  /** Pixels of the stored original for `photoArtworkId` (the space of `Candidate.bbox`). */
  imageSize?: ImageSize | null;
  /**
   * What Adjust the area frames (R2): the photo artwork and the piece (picked on Choose a pattern,
   * `fromPattern`, or the single piece the server found); no `candidateId` when no drawing was
   * found: the frame starts at the whole photo.
   */
  area?: { artworkId: string; candidateId?: string; fromPattern?: boolean };
  /** The cut piece (Adjust the area's `cleanup`); the same row as `photoArtworkId`. */
  pieceArtworkId?: string;
  pieceCandidateId?: string;
  pieceUrl?: string | null;
  pieceAlt?: string | null;
  pieceSpoken?: string | null;
  /** The frame the piece was cut with on Adjust the area (image pixels). */
  pieceBox?: Box;
  /** Every change made in this draft, oldest first. */
  changes?: ChangeStep[];
  /** The change on screen; unset = the picked piece itself ("Back to my original" moves it to the parent). */
  changedArtworkId?: string;
  /** The request being made on "Changing your art" (typed, or the transcript when spoken). */
  changeInstruction?: string;
  changeTranscript?: string;
  /**
   * One id per "Make the change": /create/changing is kept mounted between visits (cacheComponents
   * keeps visited routes in a hidden Activity), so its state is keyed by this, never reused.
   */
  changeNonce?: string;
  /** The row that "Your cutout" works on (the piece, or the change result after `cutout`). */
  cutoutArtworkId?: string;
  cutout?: CutoutState;
  /** Product trouble reported by the last cleanup, shown on Ready. */
  cutoutNotice?: string;
  /** The artwork the product was made from. */
  artworkId?: string;
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

/** The sign-in id in `document.cookie` (null when signed out or never set). */
export function sessionMarker(cookie: string): string | null {
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === CREATOR_SESSION_COOKIE) return decodeURIComponent(v.join("=")) || null;
  }
  return null;
}

/**
 * The cached draft and profile, only when they were saved under the current sign-in id; after a
 * sign-in as someone else (or a sign-out) the cache belongs to another creator and is dropped (T127).
 */
export function restore(raw: string | null, marker: string | null): { draft: Draft; creator: Creator | null } {
  if (!raw) return { draft: {}, creator: null };
  try {
    const saved = JSON.parse(raw) as { draft?: Draft; creator?: Creator | null; session?: string | null };
    if ((saved.session ?? null) !== marker) return { draft: {}, creator: null };
    return { draft: saved.draft ?? {}, creator: saved.creator ?? null };
  } catch {
    return { draft: {}, creator: null };
  }
}

function currentMarker(): string | null {
  try { return typeof document === "undefined" ? null : sessionMarker(document.cookie); } catch { return null; }
}

function load(): State {
  if (state) return state;
  let draft: Draft = {};
  let creator: Creator | null = null;
  try {
    ({ draft, creator } = restore(sessionStorage.getItem(KEY), currentMarker()));
  } catch { /* storage blocked */ }
  state = { ready: true, draft, creator };
  return state;
}
function save(next: State) {
  state = next;
  try { sessionStorage.setItem(KEY, JSON.stringify({ draft: next.draft, creator: next.creator, session: currentMarker() })); } catch { /* storage blocked */ }
  listeners.forEach((l) => l());
}
function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

/** The draft as it is now (for callbacks that finish after a render). */
export function getDraft(): Draft { return load().draft; }
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

/** POST /products for the chosen artwork and remember it (`attempt` makes a retry a new request). */
export async function makeProduct(artworkId: string, type: ProductType, attempt = 0): Promise<Product> {
  const product = await once(`product:${artworkId}:${type}:${attempt}`, () => api<Product>("products", { json: { artworkId, type } }));
  updateDraft({ productRecord: product, artworkId, listing: undefined, trace: undefined });
  return product;
}

/** The change on screen, when there is one. */
export function currentChange(d: Draft): ChangeStep | null {
  return d.changedArtworkId ? d.changes?.find((c) => c.artworkId === d.changedArtworkId) ?? null : null;
}

/** The row "Change it" edits next and "Looks good as is" cuts out: the change on screen, else the piece. */
export function currentArtworkId(d: Draft): string | undefined {
  return currentChange(d)?.artworkId ?? d.pieceArtworkId;
}

/** "Back to my original": the change's parent (the previous change, or the piece). No API call. */
export function backToOriginal(d: Draft): Partial<Draft> {
  const step = currentChange(d);
  if (!step) return {};
  const parent = d.changes?.find((c) => c.artworkId === step.parentId);
  return { changedArtworkId: parent?.artworkId };
}

/** Records a change result and puts it on screen. */
export function addChange(d: Draft, step: ChangeStep): Partial<Draft> {
  return { changes: [...(d.changes ?? []).filter((c) => c.artworkId !== step.artworkId), step], changedArtworkId: step.artworkId };
}

/**
 * "Looks good as is" / "Use this": the cut-out to show on Your cutout. For the picked piece it exists
 * already (from `select`, no call); for a change result it is made by `POST /artworks/{id}/cutout`
 * on the cutout screen (returns null here).
 */
export function pieceCutout(d: Draft): CutoutState | null {
  if (currentChange(d) || !d.pieceArtworkId) return null;
  return {
    artworkId: d.pieceArtworkId,
    candidates: d.candidates ?? [],
    imageSize: d.imageSize ?? null,
    selectedIds: d.pieceCandidateId ? [d.pieceCandidateId] : [],
    cleanedUrl: d.pieceUrl ?? null,
    altText: d.pieceAlt ?? null,
  };
}


/**
 * The product picture creator screens show (R1): the bordered sticker preview, else the cut-out art
 * (always for a tote). Never the AI mockup: it re-draws the art and changes its proportions.
 */
export function productPicture(p: Pick<Product, "type" | "previewUrl"> | null | undefined, cut: Pick<CutoutState, "cleanedUrl"> | null | undefined): string | null {
  if (p && p.type !== "tote" && p.previewUrl) return p.previewUrl;
  return cut?.cleanedUrl ?? null;
}
