/**
 * The creator flow's routing and draft decisions (canonical order, T130: photo → pattern → adjust
 * the area → making your cutout → your cutout → change it → [changing → compare → making your
 * cutout → your cutout] → making the product),
 * kept out of the screens so they can be tested with a mocked `api` and router.
 */
import { m } from "@/components/messages";
import { uuid, type Artwork, type Candidate, type ChangeResult, type CleanupResult, type CutoutResult, type Product } from "./api";
import { sameBox } from "./area";
import { productNotice, wholeImageBox, type Box, type CleanupRequest } from "./cutout";
import { addChange, currentArtworkId, currentChange, cutoutOf, withCutout, type ChangeStep, type CutoutState, type Draft } from "./store";

export type FlowRouter = { push: (href: string) => void; replace: (href: string) => void };
export type FlowApi = <T>(path: string, init?: { method?: string; json?: unknown }) => Promise<T>;
export type FlowDeps = { api: FlowApi; router: FlowRouter; update: (patch: Partial<Draft>) => void; getDraft: () => Draft };

/** Everything picked, changed or cut for an earlier piece. */
export const NEW_PIECE: Partial<Draft> = {
  pieceArtworkId: undefined, pieceCandidateId: undefined, pieceUrl: undefined, pieceAlt: undefined, pieceSpoken: undefined, pieceBox: undefined,
  changes: undefined, changedArtworkId: undefined, changeInstruction: undefined, changeTranscript: undefined,
  pendingArea: undefined, cutoutArtworkId: undefined, cutouts: undefined, cutoutNotice: undefined,
};

const NOTICE_COPY = { failed: m.create.select.failedProducts, unpublished: m.create.select.unpublishedProducts };

// ---- Take a photo / Upload a picture

export type PhotoResult = { artwork: Artwork; candidates: Candidate[]; imageSize?: { w: number; h: number } | null };

/**
 * After `POST /artworks` (photo): one piece the server already cut → Adjust the area on that piece
 * (R2: the area is always set there; the server's cut is replaced by the frame's); otherwise →
 * Choose a pattern.
 */
export function afterPhoto({ router, update }: Pick<FlowDeps, "router" | "update">, res: PhotoResult): void {
  const fresh = { ...NEW_PIECE, area: undefined, photoArtworkId: res.artwork.id, candidates: res.candidates, imageSize: res.imageSize ?? null };
  if (res.artwork.cleanedUrl) {
    update({ ...fresh, area: { artworkId: res.artwork.id, candidateId: res.candidates[0]?.id } });
    router.push("/create/adjust");
    return;
  }
  update(fresh);
  router.push("/create/pattern");
}

/** Zero pieces found ("Draw a box around your drawing"): Adjust the area on this photo, framed on the whole photo. */
export function adjustWholePhoto({ router, update }: Pick<FlowDeps, "router" | "update">, artworkId: string): void {
  update({ ...NEW_PIECE, photoArtworkId: artworkId, candidates: [], imageSize: null, area: { artworkId } });
  router.push("/create/adjust");
}

// ---- Choose a pattern

/** "Use this" on Choose a pattern: Adjust the area opens framed on that piece (no call yet). */
export function pickPiece({ router, update }: Pick<FlowDeps, "router" | "update">, artworkId: string, candidateId: string): void {
  update({ area: { artworkId, candidateId, fromPattern: true } });
  router.push("/create/adjust");
}

// ---- Adjust the area (R2)

/** Back from Adjust the area: Choose a pattern when the piece was picked there, else the photo screen. */
export function adjustBack(d: Draft): string {
  if (d.area?.fromPattern) return "/create/pattern";
  return d.method === "upload" ? "/create/photo?mode=upload" : "/create/photo?mode=camera";
}

/**
 * The `cleanup` body for the frame: the picked piece plus the box (only the box when no piece was
 * found), with `clipToBox` so nothing of the cut lies outside the frame (T126; a frame that leaves
 * nothing answers 422 `no_drawing_found`, shown as "move or grow the frame").
 */
export function areaRequest(area: { candidateId?: string }, box: Box): { candidateIds?: string[]; box: Box; clipToBox: true } {
  return area.candidateId
    ? { candidateIds: [area.candidateId], box: [...box] as Box, clipToBox: true }
    : { box: [...box] as Box, clipToBox: true };
}

/**
 * "Use this area" (T130): on to /create/cutout, where Making your cutout sends `POST
 * /artworks/{id}/cleanup {candidateIds:[piece], box, clipToBox: true}` (`runAreaCut`). The same
 * piece with the same frame as last time keeps its cut (no call) and shows Your cutout again, on
 * the piece (a change made before is dropped: it was made from the old cut).
 */
export function cutArea({ router, update, getDraft }: Pick<FlowDeps, "router" | "update" | "getDraft">, box: Box): void {
  const d = getDraft();
  const area = d.area;
  if (!area) return;
  // A second tap while the same cut is on its way (T133): no second cleanup, the same Making screen.
  const p = d.pendingArea;
  if (p && p.artworkId === area.artworkId && p.candidateId === area.candidateId && sameBox(p.box, box)) {
    router.push("/create/cutout");
    return;
  }
  if (d.pieceArtworkId === area.artworkId && d.pieceCandidateId === area.candidateId && sameBox(d.pieceBox, box) && d.pieceUrl && cutoutOf(d, area.artworkId)) {
    update({ changedArtworkId: undefined, changes: undefined, changeInstruction: undefined, changeTranscript: undefined, cutoutArtworkId: area.artworkId });
    router.push("/create/cutout");
    return;
  }
  update({ ...NEW_PIECE, cutoutArtworkId: area.artworkId, pendingArea: { artworkId: area.artworkId, candidateId: area.candidateId, box: [...box] as Box, nonce: newNonce() } });
  router.push("/create/cutout");
}

/**
 * Making your cutout for "Use this area": the `cleanup` call, then the cut piece is the piece and
 * its cut is on Your cutout (the screen follows the draft; no navigation). A result for a frame
 * that was replaced meanwhile (Back, a new frame) is dropped.
 */
export async function runAreaCut({ api, update, getDraft }: Pick<FlowDeps, "api" | "update" | "getDraft">, job: NonNullable<Draft["pendingArea"]>): Promise<void> {
  const art = await api<CleanupResult>(`artworks/${job.artworkId}/cleanup`, { json: areaRequest(job, job.box) });
  const d = getDraft();
  if (d.pendingArea?.nonce !== job.nonce) return;
  const cut: CutoutState = {
    artworkId: job.artworkId, candidates: d.candidates ?? [], imageSize: d.imageSize ?? null,
    selectedIds: job.candidateId ? [job.candidateId] : [], cleanedUrl: art.cleanedUrl, altText: art.altText, box: [...job.box] as Box, points: [],
  };
  update({
    pendingArea: undefined, pieceArtworkId: job.artworkId, pieceCandidateId: job.candidateId, pieceBox: [...job.box] as Box,
    pieceUrl: art.cleanedUrl, pieceAlt: art.altText, pieceSpoken: art.spokenDescription,
    ...withCutout(d, cut), cutoutArtworkId: job.artworkId,
    cutoutNotice: productNotice(art.details, NOTICE_COPY) ?? undefined,
  });
}

/** Making your cutout for a change result: `POST /artworks/{id}/cutout` (once per artwork); the box for later marks is the whole picture. */
export async function runChangeCut({ api, update, getDraft }: Pick<FlowDeps, "api" | "update" | "getDraft">, artworkId: string): Promise<void> {
  const res = await api<CutoutResult>(`artworks/${artworkId}/cutout`, { method: "POST", json: {} });
  const first = res.candidates[0]?.id;
  const cut: CutoutState = {
    artworkId, candidates: res.candidates, imageSize: res.imageSize, selectedIds: first ? [first] : [],
    cleanedUrl: res.artwork.cleanedUrl, altText: res.artwork.altText, box: wholeImageBox(res.imageSize), points: [],
  };
  update({ ...withCutout(getDraft(), cut), cutoutNotice: undefined });
}

/** What /create/cutout shows for the draft: Your cutout, Making your cutout (the area cut or a change result's cutout), or nothing to show. */
export function cutoutVisit(d: Draft): "cut" | "area" | "change" | "missing" {
  const target = d.cutoutArtworkId;
  if (!target) return "missing";
  if (d.pendingArea?.artworkId === target) return "area";
  if (cutoutOf(d, target)) return "cut";
  return d.changes?.some((c) => c.artworkId === target) ? "change" : "missing";
}

/** Where Making your cutout's Back goes after a failure: Adjust the area for the area cut, Before and after for a change. */
export function makingCutoutBack(kind: "area" | "change"): string {
  return kind === "area" ? "/create/adjust" : "/create/compare";
}

// ---- Your cutout

/** True when Your cutout shows a change result (not the piece cut on Adjust the area). */
export function cutIsChange(d: Draft, artworkId: string): boolean {
  return artworkId !== d.pieceArtworkId;
}

/** Back from Your cutout: Adjust the area on the first pass, Before and after after a change. */
export function yourCutoutBack(d: Draft, artworkId: string): string {
  return cutIsChange(d, artworkId) ? "/create/compare" : "/create/adjust";
}

/**
 * Apply cutout (T130): `cleanup {candidateIds?, box, points, clipToBox: true}` on the artwork on
 * screen (the piece, or the change result); the saved cut replaces the one on Your cutout (and the
 * piece's picture on Change it, for the piece).
 */
export async function applyMarks({ api, update, getDraft }: Pick<FlowDeps, "api" | "update" | "getDraft">, cut: CutoutState, req: CleanupRequest): Promise<{ cut: CutoutState; notice: string | null }> {
  const art = await api<CleanupResult>(`artworks/${cut.artworkId}/cleanup`, { json: req });
  const d = getDraft();
  const next: CutoutState = { ...cut, cleanedUrl: art.cleanedUrl, altText: art.altText, points: (req.points ?? []).map((p) => ({ ...p })) };
  const notice = productNotice(art.details, NOTICE_COPY);
  const piece = cut.artworkId === d.pieceArtworkId ? { pieceUrl: art.cleanedUrl, pieceAlt: art.altText, pieceSpoken: art.spokenDescription } : {};
  update({ ...withCutout(d, next), ...piece, cutoutNotice: notice ?? undefined });
  return { cut: next, notice };
}

/**
 * "Use this" on Your cutout: the piece goes on to Change it (on the piece, not on an earlier
 * change); a change result goes on to Making your sticker / tote bag.
 */
export function takeCutout({ router, update, getDraft }: Pick<FlowDeps, "router" | "update" | "getDraft">, artworkId: string): void {
  if (!cutIsChange(getDraft(), artworkId)) {
    update({ changedArtworkId: undefined, cutoutArtworkId: artworkId });
    router.push("/create/change");
    return;
  }
  toMaking({ router, update }, artworkId);
}

/**
 * On to Making your sticker / tote bag for `artworkId`. The draft product is kept: Making reuses
 * it for the same artwork and type (consistency item 6, `productToMake`). Each "Use this" mints the
 * `clientRequestId` its `POST /products` carries (round 3 ruling 6); Try again reuses it, so a retry
 * after a lost answer gets the same row back.
 */
export function toMaking({ router, update }: Pick<FlowDeps, "router" | "update">, artworkId: string): void {
  update({ artworkId, productRequestId: uuid() });
  router.push("/create/making");
}

// ---- Change it

/** "Make the change": the request (and what the mic heard, when it was not retyped) for Changing your art. */
export function submitChange({ router, update }: Pick<FlowDeps, "router" | "update">, text: string, heard: string | null): boolean {
  const instruction = text.trim();
  if (!instruction) return false;
  update({ changeInstruction: instruction, changeTranscript: heard && heard.trim() === instruction ? heard : undefined, changeNonce: newNonce() });
  router.push("/create/changing");
  return true;
}

/** A new request id (a uuid): the `changeNonce` doubles as the change's `clientRequestId` (round 3 ruling 6). */
function newNonce(): string {
  return uuid();
}

/**
 * What a (re)shown /create/changing does for the request it was opened with (`nonce`): send it
 * while it is still waiting; once it has finished (or was dropped by "Back to my art") never send
 * it again, but go to Before and after, or to Change it when no change exists.
 */
export function changingVisit(d: Draft, nonce: string | undefined): "send" | "compare" | "change" {
  if (d.changeInstruction && d.changeNonce === nonce) return "send";
  return d.changedArtworkId ? "compare" : "change";
}

/**
 * Sets a screen's busy flag while `run` works and clears it afterwards, also after a successful
 * navigation: visited routes stay mounted (cacheComponents), so a flag left set would come back
 * locked when the creator returns to the screen.
 */
export async function busyWhile<T>(set: (v: T) => void, busy: T, idle: T, run: () => Promise<unknown>): Promise<void> {
  set(busy);
  try { await run(); } finally { set(idle); }
}

/**
 * Back from Change it: Your cutout (T130), also while a change is on screen (Before and after's
 * Back goes to Change it, so pointing at Before and after made a loop). The change chain stays in
 * the draft, so "Change it again" from Before and after still works.
 */
export function changeItBack(d: Draft): string {
  if (changeItCut(d)) return "/create/cutout";
  if (d.area) return "/create/adjust";
  return d.method === "upload" ? "/create/photo?mode=upload" : "/create/photo?mode=camera";
}

/**
 * The cut Change it's Back opens (T133): the cut of the art on screen when it has one, else the
 * piece's cut; null when there is none. Change it keeps `cutoutArtworkId` on it, so Back never opens
 * the cut of a change that is no longer on screen.
 */
export function changeItCut(d: Draft): string | null {
  const target = currentArtworkId(d);
  if (target && cutoutOf(d, target)) return target;
  return d.pieceArtworkId && cutoutOf(d, d.pieceArtworkId) ? d.pieceArtworkId : null;
}

/**
 * "Looks good as is" (T130): the cut was already reviewed on Your cutout, so straight on to Making
 * your sticker / tote bag. Only a change on screen that was never cut (Back to my original onto an
 * earlier change) is cut first.
 */
export function skipChange({ router, update, getDraft }: Pick<FlowDeps, "router" | "update" | "getDraft">): void {
  const d = getDraft();
  const target = currentArtworkId(d);
  if (!target) return;
  if (target === d.pieceArtworkId || cutoutOf(d, target)?.cleanedUrl) { toMaking({ router, update }, target); return; }
  update({ cutoutArtworkId: target });
  router.push("/create/cutout");
}

/** Before and after's "Use this": the change result's cut-out (made once per artwork) on Your cutout. */
export function takeChange({ router, update }: Pick<FlowDeps, "router" | "update">, artworkId: string): void {
  update({ cutoutArtworkId: artworkId });
  router.push("/create/cutout");
}

// ---- Changing your art

/**
 * What /create/changing does on arrival, decided once: a request is waiting → run it; none waiting
 * but a change exists (a reload after it finished) → Before and after; nothing → start over.
 */
export function changingEntry(d: Draft): "run" | "compare" | "missing" {
  if (d.changeInstruction && d.pieceArtworkId) return "run";
  if (d.changedArtworkId) return "compare";
  return "missing";
}

export type ChangeRequest = { base: string; instruction: string; transcript?: string; clientRequestId?: string };

/** The request Changing your art sends, captured on arrival; its `clientRequestId` is the "Make the change" nonce. */
export function changeRequest(d: Draft): ChangeRequest | null {
  const base = currentArtworkId(d);
  if (!base || !d.changeInstruction) return null;
  return { base, instruction: d.changeInstruction, transcript: d.changeTranscript, ...(d.changeNonce ? { clientRequestId: d.changeNonce } : {}) };
}

/**
 * `POST /artworks/{base}/change`, then the child goes on screen and Before and after opens. Try again
 * sends the same `clientRequestId`, so a change the server already made comes back instead of a second one.
 */
export async function runChange({ api, router, update, getDraft }: FlowDeps, req: ChangeRequest): Promise<ChangeStep> {
  const { artwork, description } = await api<ChangeResult>(`artworks/${req.base}/change`, {
    json: {
      instruction: req.instruction,
      ...(req.transcript ? { transcript: req.transcript } : {}),
      ...(req.clientRequestId ? { clientRequestId: req.clientRequestId } : {}),
    },
  });
  const step: ChangeStep = {
    artworkId: artwork.id, parentId: req.base, instruction: req.instruction, transcript: req.transcript,
    previewUrl: artwork.previewUrl, alt: description.alt || artwork.altText, spoken: description.spoken || artwork.spokenDescription,
    differences: description.differences ?? "",
  };
  update({ ...addChange(getDraft(), step), changeInstruction: undefined, changeTranscript: undefined });
  router.replace("/create/compare");
  return step;
}

/** "Back to my art" after a failed change: back to Change it (to retype), then drop the waiting request. */
export function leaveChanging({ router, update }: Pick<FlowDeps, "router" | "update">): void {
  router.replace("/create/change");
  update({ changeInstruction: undefined, changeTranscript: undefined });
}

/** The art on screen on Change it / Changing: the change, else the picked piece. */
export function artOnScreen(d: Draft): { src: string | null; alt: string | null; shows: string | null } {
  const step = currentChange(d);
  return step
    ? { src: step.previewUrl, alt: step.alt, shows: step.spoken ?? step.alt }
    : { src: d.pieceUrl ?? null, alt: d.pieceAlt ?? null, shows: d.pieceSpoken ?? d.pieceAlt ?? null };
}

// ---- Get it ready for the shop

/**
 * "Redo" while the listing drafts (round 3 ruling 5): the run is dropped by its nonce (the server
 * finishes it and the answer is ignored; `listings/run` upserts), and Your cutout of the product's
 * artwork opens. The draft product is kept, so Use this reuses it (no second `POST /products`).
 */
export function redoListing({ router, update }: Pick<FlowDeps, "router" | "update">, product: Pick<Product, "artworkId">): void {
  update({ listingRun: undefined, listing: undefined, trace: undefined, cutoutArtworkId: product.artworkId });
  router.push("/create/cutout");
}

/** Redo is offered only when the product's artwork has a cut in this draft (Your cutout can show it). */
export function canRedoListing(d: Draft): boolean {
  return !!d.productRecord && !!cutoutOf(d, d.productRecord.artworkId);
}

// ---- Story video (R6)

/** Where "Record again" (My story video on Choose a product) came from and returns to. */
export const STORY_REDO_RETURN = "/create/product";

/**
 * Where the story video screen goes after saving (or after the drafted story is used or skipped):
 * You're live after the first listing; back to Choose a product in redo mode (Record again).
 */
export function storyVideoDone(redo: boolean): string {
  return redo ? STORY_REDO_RETURN : "/create/live";
}
