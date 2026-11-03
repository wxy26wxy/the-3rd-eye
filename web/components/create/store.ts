"use client";
/**
 * Creator-flow draft, kept in sessionStorage so a refresh or a back/forward does not lose
 * work, and tied to the current sign-in (`ms_creator_session`), so another creator never sees it.
 * Exposed through useSyncExternalStore; the server snapshot has `ready: false` so screens can wait
 * for hydration instead of flashing "missing" states.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Box, CutoutPoint, ImageSize } from "./cutout";
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
  /** The "Make the change" nonce that made it (its `clientRequestId`): Try again on Changing skips a change already made. */
  requestId?: string;
};

/**
 * A product made in this draft for an artwork (round 4 ruling 2: made before Change it and after
 * every change), with the cut-out (`cleanedUrl`) its pictures were made from; another cut on the
 * artwork means the server rebuilt them.
 */
export type MadeProduct = Product & { cut: string | null };

/** The artwork whose cut-out "Your cutout" shows, with its SAM pieces. */
export type CutoutState = {
  artworkId: string;
  candidates: Candidate[];
  imageSize: ImageSize | null;
  /** The pieces in the current cut (the picked piece, or the largest one after `cutout`). */
  selectedIds: string[];
  cleanedUrl: string | null;
  altText: string | null;
  /**
   * The box Apply cutout sends with the marks: the whole working picture `[0, 0, w, h]` (round 4: the
   * piece's picture is already the crop; a change result is the edited picture).
   */
  box: Box | null;
  /** The Add area / Remove area marks the saved cut was made with (none for the first cut). */
  points: CutoutPoint[];
};

export type Draft = {
  product?: ProductType;
  method?: "photo" | "upload";
  /**
   * What Adjust the area frames (round 4 ruling 1): the photo on the device, by its key in the
   * in-memory map (`localPhoto.ts`; lost on a reload), its size as shown (orientation applied), and
   * the last frame used ("Back" returns to it; the whole photo at first).
   */
  area?: { photoKey: string; size: ImageSize; frame?: Box };
  /** The local photo was lost (a reload during the flow): the photo step says to pick it again. */
  photoLost?: boolean;
  /**
   * The crop of this frame found nothing (`422 no_drawing_found`): Adjust the area says to move or
   * grow the frame; "Use this area" on the same frame sends nothing again.
   */
  areaNotFound?: { photoKey: string; box: Box; /** The row that answered 422 (deleted on the next Use this area or Take a new photo). */ artworkId?: string; /** The earlier photo row still to delete once a later upload succeeds. */ replaces?: string };
  /** The cut piece: the row `POST /artworks` made from the crop (its original is the crop). */
  pieceArtworkId?: string;
  pieceUrl?: string | null;
  pieceAlt?: string | null;
  pieceSpoken?: string | null;
  /** The photo and frame the piece's crop was made from (local photo pixels). */
  piecePhotoKey?: string;
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
  /**
   * The crop "Use this area" asked for, run by Making your cutout (crop → upload → `POST /artworks`);
   * `nonce` is new per "Use this area", so a kept-mounted /create/cutout never re-sends an older one.
   */
  pendingArea?: { photoKey: string; box: Box; nonce: string; /** The earlier photo row this re-frame supersedes; deleted after the new `POST /artworks` succeeds. */ replaces?: string };
  /** The row that "Your cutout" works on (the piece, or the change result after `cutout`). */
  cutoutArtworkId?: string;
  /** Every cut made in this draft, by artwork (a change result is cut once, T130). */
  cutouts?: Record<string, CutoutState>;
  /** Product trouble reported by the last cleanup, shown on Ready. */
  cutoutNotice?: string;
  /** The artwork the product on Ready / Listing was made from. */
  artworkId?: string;
  /** Products made in this draft, by artwork (the draft's type); Change it and Before and after show their photos. */
  made?: Record<string, MadeProduct>;
  /**
   * The `POST /products` Change it's making state sends for `artworkId`: `requestId` is its
   * `clientRequestId`, minted per "Use this" (and per change), reused by Try again and remounts.
   */
  productJob?: { artworkId: string; requestId: string };
  /** Where Your cutout's Back returns after "Fix the cutout" (Change it or Before and after). */
  cutoutReturn?: string;
  /** Nonce of the listing agent run on screen; a result for another one (Redo) is dropped. */
  listingRun?: string;
  /** The product Ready and Listing work on (set by "Looks good as is"). */
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
/** The signed-in creator's profile when it was loaded already (for callbacks). */
export function getCreator(): Creator | null { return load().creator; }
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

/** The product made in this draft for `artworkId` (of the draft's type), when there is one. */
export function madeFor(d: Draft, artworkId: string | undefined): MadeProduct | null {
  const p = artworkId ? d.made?.[artworkId] : undefined;
  return p && p.type === d.product ? p : null;
}

/**
 * What Change it needs for `artworkId` before it shows the product photo (round 4 ruling 2):
 * "ready" (made, pictures of the current cut), "make" (`POST /products`), or "refresh" (made, but a
 * later cut rebuilt it and the new pictures are not in the draft yet: `GET /artworks`).
 */
export function productPlan(d: Draft, artworkId: string | undefined): "ready" | "make" | "refresh" {
  const p = madeFor(d, artworkId);
  if (!p) return "make";
  const cut = cutoutOf(d, artworkId)?.cleanedUrl ?? null;
  return cut && p.cut !== cut ? "refresh" : "ready";
}

/**
 * Records a made or rebuilt product. When it is the product on Ready / Listing, that record follows
 * and its listing is dropped (the rebuild made the print check stale; the listing is drafted again).
 */
export function recordProduct(d: Draft, artworkId: string, p: MadeProduct): Partial<Draft> {
  const { cut: _cut, ...product } = p;
  void _cut;
  const onListing = d.productRecord?.id === p.id;
  return {
    made: { ...(d.made ?? {}), [artworkId]: p },
    ...(onListing ? { productRecord: product, listing: undefined, trace: undefined, listingRun: undefined } : {}),
  };
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

/** The saved cut of `artworkId`, when there is one. */
export function cutoutOf(d: Draft, artworkId: string | undefined): CutoutState | null {
  return artworkId ? d.cutouts?.[artworkId] ?? null : null;
}

/** Records a cut (the area cut, a change result's `cutout`, or Apply cutout). */
export function withCutout(d: Draft, cut: CutoutState): Partial<Draft> {
  return { cutouts: { ...(d.cutouts ?? {}), [cut.artworkId]: cut } };
}

/**
 * The product picture creator screens show (Ready, Listing; round 3 ruling 1): the AI product photo
 * (`mockupUrl`) for both types, else a sticker's bordered preview, else the cut-out art; with how to
 * show it: "photo" (the AI photo, on the grey card), "sticker" (the bordered
 * preview, soft shadow so its white border reads), "art" (the cut-out).
 */
export function pictureOf(p: Pick<Product, "type" | "previewUrl" | "mockupUrl"> | null | undefined, cut: Pick<CutoutState, "cleanedUrl"> | null | undefined): { src: string | null; kind: "photo" | "sticker" | "art" } {
  if (p?.mockupUrl) return { src: p.mockupUrl, kind: "photo" };
  if (p && p.type !== "tote" && p.previewUrl) return { src: p.previewUrl, kind: "sticker" };
  return { src: cut?.cleanedUrl ?? null, kind: "art" };
}
