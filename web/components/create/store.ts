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
  /**
   * The box Apply cutout sends with the marks (T130): the frame from Adjust the area for the piece,
   * the whole picture for a change result.
   */
  box: Box | null;
  /** The Add area / Remove area marks the saved cut was made with (none for the first cut). */
  points: CutoutPoint[];
};

export type Draft = {
  product?: ProductType;
  method?: "photo" | "upload";
  /** The photo artwork (POST /artworks) and its SAM pieces. */
  photoArtworkId?: string;
  candidates?: Candidate[];
  /** Pixels of the stored original for `photoArtworkId` (the space of `Candidate.bbox`). */
  imageSize?: ImageSize | null;
  /** What Adjust the area frames (round 3): the photo artwork; the frame starts at the whole photo. */
  area?: { artworkId: string };
  /** The last `detect` found nothing in the frame: Adjust the area says to move or grow it. */
  areaNotFound?: boolean;
  /** The cut piece (Adjust the area's `cleanup`); the same row as `photoArtworkId`. */
  pieceArtworkId?: string;
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
  /**
   * The cut "Use this area" asked for, run by Making your cutout (T130); `nonce` is new per "Use
   * this area", so a kept-mounted /create/cutout never re-sends an older one.
   */
  pendingArea?: { artworkId: string; box: Box; nonce: string };
  /** The row that "Your cutout" works on (the piece, or the change result after `cutout`). */
  cutoutArtworkId?: string;
  /** Every cut made in this draft, by artwork (a change result is cut once, T130). */
  cutouts?: Record<string, CutoutState>;
  /** Product trouble reported by the last cleanup, shown on Ready. */
  cutoutNotice?: string;
  /** The artwork the product was made from. */
  artworkId?: string;
  /** `clientRequestId` of the `POST /products` for the current "Use this" (Try again reuses it). */
  productRequestId?: string;
  /** Nonce of the listing agent run on screen; a result for another one (Redo) is dropped. */
  listingRun?: string;
  productRecord?: Product;
  /** The cut-out (`cleanedUrl`) `productRecord`'s files were made from; another one means the server rebuilt them. */
  productCut?: string | null;
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

/**
 * POST /products for the chosen artwork and remember it (`attempt` makes a retry a new request; the
 * same `clientRequestId` on a retry returns the row the server already made).
 */
export async function makeProduct(artworkId: string, type: ProductType, attempt = 0, cut: string | null = null, clientRequestId?: string): Promise<Product> {
  const json = clientRequestId ? { artworkId, type, clientRequestId } : { artworkId, type };
  const product = await once(`product:${artworkId}:${type}:${attempt}`, () => api<Product>("products", { json }));
  updateDraft({ productRecord: product, productCut: cut, artworkId, listing: undefined, trace: undefined });
  return product;
}

/**
 * Making your sticker / tote bag for `d.artworkId` (consistency item 6): "make" a new product, or
 * "reuse" the draft product already made for the same artwork and type (browser back + Use this
 * never posts a second product); "refresh" reuses it but its files were rebuilt by a later cut
 * (Apply cutout), so its pictures are read again.
 */
export function productToMake(d: Draft): "make" | "reuse" | "refresh" {
  const p = d.productRecord;
  if (!d.artworkId || !d.product || !p || p.artworkId !== d.artworkId || p.type !== d.product) return "make";
  const cut = d.cutouts?.[d.artworkId]?.cleanedUrl ?? null;
  return cut && d.productCut !== undefined && d.productCut !== cut ? "refresh" : "reuse";
}

/**
 * The product's pictures again after a rebuild (`GET /artworks` carries each product's `mockupUrl` /
 * `previewUrl`). The rebuild made the old listing's print check stale, so the listing is dropped and
 * Get it ready for the shop drafts it again.
 */
export async function refreshProduct(p: Product, cut: string | null): Promise<void> {
  const res = await api<{ artworks: { id: string; products: { id: string; mockupUrl: string | null; previewUrl: string | null }[] }[] }>("artworks");
  const fresh = res.artworks.find((a) => a.id === p.artworkId)?.products.find((x) => x.id === p.id);
  updateDraft({ productRecord: fresh ? { ...p, mockupUrl: fresh.mockupUrl, previewUrl: fresh.previewUrl } : p, productCut: cut, listing: undefined, trace: undefined, listingRun: undefined });
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
