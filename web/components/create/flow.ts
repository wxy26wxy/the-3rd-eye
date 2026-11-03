/**
 * The creator flow's routing and draft decisions (canonical order, round 4: photo (kept on the
 * device) → adjust the area on the local photo → making your cutout (crop → upload → `POST
 * /artworks`) → your cutout → change it → [changing → compare → making your cutout → your cutout] →
 * making the product), kept out of the screens so they can be tested with a mocked `api` and router.
 */
import { m } from "@/components/messages";
import { uuid, type Artwork, type Candidate, type ChangeResult, type CleanupResult, type CutoutResult } from "./api";
import { sameBox } from "./area";
import { productNotice, usableSize, wholeImageBox, type Box, type CleanupRequest, type ImageSize } from "./cutout";
import { getPhoto, hasPhoto } from "./localPhoto";
import { addChange, currentArtworkId, currentChange, cutoutOf, withCutout, type ChangeStep, type CutoutState, type Draft } from "./store";

export type FlowRouter = { push: (href: string) => void; replace: (href: string) => void };
export type FlowApi = <T>(path: string, init?: { method?: string; json?: unknown }) => Promise<T>;
export type FlowDeps = { api: FlowApi; router: FlowRouter; update: (patch: Partial<Draft>) => void; getDraft: () => Draft };

/** Everything picked, changed or cut for an earlier piece. */
export const NEW_PIECE: Partial<Draft> = {
  pieceArtworkId: undefined, pieceUrl: undefined, pieceAlt: undefined, pieceSpoken: undefined, piecePhotoKey: undefined, pieceBox: undefined,
  changes: undefined, changedArtworkId: undefined, changeInstruction: undefined, changeTranscript: undefined,
  pendingArea: undefined, cutoutArtworkId: undefined, cutouts: undefined, cutoutNotice: undefined,
};

const NOTICE_COPY = { failed: m.create.select.failedProducts, unpublished: m.create.select.unpublishedProducts };

// ---- Take a photo / Upload a picture

/** `POST /artworks {source:"photo", imageUrl, product, framed: true}` (T143: detection on the whole crop, the largest piece cut). */
export type PhotoResult = { artwork: Artwork; candidates: Candidate[]; imageSize?: ImageSize | null; details?: CleanupResult["details"] };

/**
 * A photo was picked (round 4 ruling 1): it stays on the device (`putPhoto(key, file)` by the
 * screen) and Adjust the area opens on it at once, the frame at the whole photo. No upload, no call.
 */
export function afterPhoto({ router, update }: Pick<FlowDeps, "router" | "update">, photo: { key: string; size: ImageSize }): void {
  update({ ...NEW_PIECE, areaNotFound: undefined, photoLost: undefined, area: { photoKey: photo.key, size: { ...photo.size } } });
  router.push("/create/adjust");
}

/** The photo step for the draft's method (where Back from Adjust the area and "Take a new photo" go). */
export function photoStep(d: Draft): string {
  return d.method === "upload" ? "/create/photo?mode=upload" : "/create/photo?mode=camera";
}

/**
 * The local photo is gone (a reload emptied the in-memory map): the photo step, which says to pick
 * it again. A crop still waiting is dropped.
 */
export function photoGone({ router, update }: Pick<FlowDeps, "router" | "update">, d: Draft): void {
  update({ photoLost: true, pendingArea: undefined, areaNotFound: undefined });
  router.replace(photoStep(d));
}

/** Adjust the area's photo is still on the device (false after a reload). */
export function hasLocalPhoto(d: Draft): boolean {
  return hasPhoto(d.area?.photoKey);
}

// ---- Adjust the area

/** Back from Adjust the area: the photo screen it came from. */
export function adjustBack(d: Draft): string {
  return photoStep(d);
}

/** "Take a new photo" on Adjust the area (and on Your cutout without the local photo): the photo step. */
export function takeNewPhoto(d: Draft): string {
  return photoStep(d);
}

/** The frame Adjust the area shows: the last one used on this photo, else the whole photo. */
export function areaFrame(d: Draft): Box | null {
  const area = d.area;
  if (!area || !usableSize(area.size)) return null;
  return area.frame ? [...area.frame] as Box : wholeImageBox(area.size);
}

/** The frame that just found nothing is still the one on screen: the advice stays, nothing is sent again. */
export function sameNotFound(d: Draft, box: Box): boolean {
  const nf = d.areaNotFound;
  return !!nf && nf.photoKey === d.area?.photoKey && sameBox(nf.box, box);
}

/**
 * "Use this area" (round 4): on to /create/cutout, where Making your cutout crops the local photo to
 * the frame, uploads the crop and sends `POST /artworks` on it (`runAreaCut`). The same photo and
 * frame as the piece on hand keeps it (no upload, no call) and shows Your cutout again on the piece
 * (a change made before is dropped: it was made from the old cut). Returns false when nothing was
 * started (no photo, or the frame that just found nothing).
 */
export function cutArea({ router, update, getDraft }: Pick<FlowDeps, "router" | "update" | "getDraft">, box: Box): boolean {
  const d = getDraft();
  const area = d.area;
  if (!area) return false;
  if (sameNotFound(d, box)) return false;
  const framed = { ...area, frame: [...box] as Box };
  // A second tap while the same crop is on its way: no second upload, the same Making screen.
  const p = d.pendingArea;
  if (p && p.photoKey === area.photoKey && sameBox(p.box, box) && !d.cutoutArtworkId) {
    router.push("/create/cutout");
    return true;
  }
  if (d.pieceArtworkId && d.piecePhotoKey === area.photoKey && sameBox(d.pieceBox, box) && d.pieceUrl && cutoutOf(d, d.pieceArtworkId)) {
    update({ area: framed, areaNotFound: undefined, pendingArea: undefined, changedArtworkId: undefined, changes: undefined, changeInstruction: undefined, changeTranscript: undefined, cutoutArtworkId: d.pieceArtworkId });
    router.push("/create/cutout");
    return true;
  }
  update({ ...NEW_PIECE, area: framed, areaNotFound: undefined, pendingArea: { photoKey: area.photoKey, box: [...box] as Box, nonce: newNonce() } });
  router.push("/create/cutout");
  return true;
}

/** Crops `file` to `box` and uploads the crop (Blob client upload); answers the uploaded URL. */
export type CropUpload = (file: Blob, box: Box) => Promise<string>;

/** Largest piece first by bbox area (only for the fallback cut when the server left the choice open). */
export function largestFirst(candidates: readonly Candidate[]): Candidate[] {
  const size = (c: Candidate) => Math.max(0, c.bbox[2] - c.bbox[0]) * Math.max(0, c.bbox[3] - c.bbox[1]);
  return [...candidates].sort((a, b) => size(b) - size(a));
}

/**
 * Making your cutout for "Use this area" (round 4): the local photo cropped to the frame and
 * uploaded (`upload`), then `POST /artworks {source:"photo", imageUrl: <crop>, product, framed:
 * true}` (T143: SAM on the whole crop, candidates largest first, `candidates[0]` cut out). The new
 * row is the piece; its original is the crop, so Your cutout marks the crop (the returned
 * `imageSize`, which may be the crop ×2) with the box `[0, 0, w, h]`. Should the server leave the
 * choice open (no `cleanedUrl`), the largest is cut here with `cleanup {candidateIds:[largest], box,
 * clipToBox}`.
 * A result for a frame that was replaced meanwhile (Back, a new frame) is dropped. Throws
 * `PhotoGoneError` when the local photo is no longer in memory.
 */
export async function runAreaCut({ api, update, getDraft, upload }: Pick<FlowDeps, "api" | "update" | "getDraft"> & { upload: CropUpload }, job: NonNullable<Draft["pendingArea"]>): Promise<void> {
  const product = getDraft().product;
  const file = getPhoto(job.photoKey);
  if (!file) throw new PhotoGoneError();
  if (!product) throw new PhotoGoneError();
  const stale = () => getDraft().pendingArea?.nonce !== job.nonce;
  const imageUrl = await upload(file, job.box);
  if (stale()) return;
  const res = await api<PhotoResult>("artworks", { json: { source: "photo", imageUrl, product, framed: true } });
  if (stale()) return;
  const size = usableSize(res.imageSize) ? res.imageSize : null;
  const box = wholeImageBox(size);
  let art: Pick<Artwork, "cleanedUrl" | "altText" | "spokenDescription"> = res.artwork;
  let details = res.details;
  // The server's order (largest first, `candidates[0]` cut); the fallback cut sorts by bbox itself.
  const pieces = art.cleanedUrl ? [...res.candidates] : largestFirst(res.candidates);
  const first = pieces[0]?.id;
  if (!art.cleanedUrl && first && box) {
    const cut = await api<CleanupResult>(`artworks/${res.artwork.id}/cleanup`, { json: pickRequest(first, box) });
    if (stale()) return;
    art = cut;
    details = cut.details;
  }
  const d = getDraft();
  const id = res.artwork.id;
  const cut: CutoutState = {
    artworkId: id, candidates: pieces, imageSize: size,
    selectedIds: first ? [first] : [], cleanedUrl: art.cleanedUrl, altText: art.altText, box, points: [],
  };
  update({
    pendingArea: undefined,
    pieceArtworkId: id, piecePhotoKey: job.photoKey, pieceBox: [...job.box] as Box,
    pieceUrl: art.cleanedUrl, pieceAlt: art.altText, pieceSpoken: art.spokenDescription,
    ...withCutout(d, cut), cutoutArtworkId: id,
    cutoutNotice: productNotice(details, NOTICE_COPY) ?? undefined,
  });
}

/** The local photo for a waiting crop is gone (a reload): Making your cutout sends the creator to the photo step. */
export class PhotoGoneError extends Error {
  constructor() { super("photo_gone"); this.name = "PhotoGoneError"; }
}

/**
 * The crop has no drawing in it (`422 no_drawing_found`): back to Adjust the area, which says to
 * move or grow the frame (only for the frame still waiting). The row the server made stays a draft.
 */
export function areaNotFound({ router, update, getDraft }: Pick<FlowDeps, "router" | "update" | "getDraft">, job: NonNullable<Draft["pendingArea"]>): void {
  if (getDraft().pendingArea?.nonce !== job.nonce) return;
  update({ pendingArea: undefined, areaNotFound: { photoKey: job.photoKey, box: [...job.box] as Box } });
  router.replace("/create/adjust");
}

/**
 * The candidate strip on Your cutout (shown for two pieces or more): picking another piece re-cuts
 * it with the frame, `cleanup {candidateIds:[picked], box, clipToBox: true}` (marks start over).
 */
export function pickRequest(candidateId: string, box: Box): { candidateIds: string[]; box: Box; clipToBox: true } {
  return { candidateIds: [candidateId], box: [...box] as Box, clipToBox: true };
}

/** The candidate strip shows only when several pieces were found. */
export function showsPieces(cut: Pick<CutoutState, "candidates">): boolean {
  return cut.candidates.length >= 2;
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
  if (!target) return d.pendingArea ? "area" : "missing";
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

/**
 * Back from Your cutout: Before and after for a change result; for the piece, Adjust the area on the
 * local photo (the last frame), or the photo step when the photo is no longer on the device.
 */
export function yourCutoutBack(d: Draft, artworkId: string): string {
  if (cutIsChange(d, artworkId)) return "/create/compare";
  return hasLocalPhoto(d) ? "/create/adjust" : photoStep(d);
}

/**
 * "Take a new photo" on Your cutout: offered on the piece when the local photo is gone (a reload, or
 * a redo from the listing after one), since re-framing needs the photo; null otherwise (Back goes
 * to Adjust the area, which has it).
 */
export function cutoutNewPhoto(d: Draft, artworkId: string): string | null {
  return !cutIsChange(d, artworkId) && !hasLocalPhoto(d) ? photoStep(d) : null;
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
  return hasLocalPhoto(d) ? "/create/adjust" : photoStep(d);
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

/** Where a redo from the listing goes: Your cutout of the product's artwork, or Adjust the area on the local photo. */
export type RedoTarget = "cutout" | "adjust";

/**
 * The redo destination for `prefer`, falling back to the other one (round 3 review m1/m2): Your
 * cutout needs the product's cut in this draft, Adjust the area needs the local photo (round 4: it
 * is gone after a reload, and the server has no uncropped photo). Null: neither.
 */
export function redoTarget(d: Draft, prefer: RedoTarget): RedoTarget | null {
  const cut = !!d.productRecord && !!cutoutOf(d, d.productRecord.artworkId);
  const photo = hasLocalPhoto(d);
  if (prefer === "cutout") return cut ? "cutout" : photo ? "adjust" : null;
  return photo ? "adjust" : cut ? "cutout" : null;
}

function goRedo({ router, update, getDraft }: Pick<FlowDeps, "router" | "update" | "getDraft">, target: RedoTarget, patch: Partial<Draft>): void {
  const d = getDraft();
  if (target === "cutout" && d.productRecord) {
    update({ ...patch, pendingArea: undefined, cutoutArtworkId: d.productRecord.artworkId });
    router.push("/create/cutout");
  } else if (hasLocalPhoto(d)) {
    update({ ...patch, pendingArea: undefined, areaNotFound: undefined });
    router.push("/create/adjust");
  }
}

/**
 * "Redo" while the listing drafts (round 3 ruling 5): the run is dropped by its nonce (the server
 * finishes it and the answer is ignored; `listings/run` upserts), and Your cutout of the product's
 * artwork opens (Adjust the area on the photo when that cut is not in the draft). The draft product
 * is kept, so Use this reuses it (no second `POST /products`).
 */
export function redoListing(deps: Pick<FlowDeps, "router" | "update" | "getDraft">): void {
  const target = redoTarget(deps.getDraft(), "cutout");
  if (target) goRedo(deps, target, { listingRun: undefined, listing: undefined, trace: undefined });
}

/** Redo is offered while drafting when it has somewhere to go. */
export function canRedoListing(d: Draft): boolean {
  return !!d.productRecord && redoTarget(d, "cutout") !== null;
}

/**
 * "Re-do the cutout" after a print check on approve (round 3 review I3): a picture too small to print
 * (`resolution`, the only hard block, which marks cannot fix) goes to Adjust the area on the local
 * photo, where the frame can grow or "Take a new photo" gives a bigger one (round 4: without the
 * local photo, Your cutout with "Take a new photo"); a contrast warning goes to Your cutout.
 * The listing stays until the product is rebuilt: a re-cut makes Making refresh the product, which
 * drops the old listing and its print check (`refreshProduct`). Clearing it here would start a new
 * agent run on the Listing screen that is still showing.
 */
export function redoCutout(deps: Pick<FlowDeps, "router" | "update" | "getDraft">, check: "resolution" | "contrast" | null): void {
  const target = redoTarget(deps.getDraft(), check === "resolution" ? "adjust" : "cutout");
  if (target) goRedo(deps, target, { listingRun: undefined });
}

/** Whether "Re-do the cutout" has somewhere to go for this check. */
export function canRedoCutout(d: Draft, check: "resolution" | "contrast" | null): boolean {
  return !!d.productRecord && redoTarget(d, check === "resolution" ? "adjust" : "cutout") !== null;
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
