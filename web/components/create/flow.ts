/**
 * The creator flow's routing and draft decisions (photo → pattern → change → compare → cutout),
 * kept out of the screens so they can be tested with a mocked `api` and router.
 */
import type { Artwork, Candidate, ChangeResult } from "./api";
import { addChange, currentArtworkId, currentChange, pieceCutout, type ChangeStep, type Draft } from "./store";

export type FlowRouter = { push: (href: string) => void; replace: (href: string) => void };
export type FlowApi = <T>(path: string, init?: { method?: string; json?: unknown }) => Promise<T>;
export type FlowDeps = { api: FlowApi; router: FlowRouter; update: (patch: Partial<Draft>) => void; getDraft: () => Draft };

/** Everything picked, changed or cut for an earlier piece. */
export const NEW_PIECE: Partial<Draft> = {
  pieceArtworkId: undefined, pieceCandidateId: undefined, pieceUrl: undefined, pieceAlt: undefined, pieceSpoken: undefined,
  changes: undefined, changedArtworkId: undefined, changeInstruction: undefined, changeTranscript: undefined,
  cutoutArtworkId: undefined, cutout: undefined, appliedCutout: undefined, cutoutNotice: undefined,
};

// ---- Take a photo / Upload a picture

export type PhotoResult = { artwork: Artwork; candidates: Candidate[]; imageSize?: { w: number; h: number } | null };

/** After `POST /artworks` (photo): one piece already cut → Change it; otherwise → Choose a pattern. */
export function afterPhoto({ router, update }: Pick<FlowDeps, "router" | "update">, res: PhotoResult): void {
  const fresh = { ...NEW_PIECE, photoArtworkId: res.artwork.id, candidates: res.candidates, imageSize: res.imageSize ?? null };
  if (res.artwork.cleanedUrl) {
    update({
      ...fresh, pieceArtworkId: res.artwork.id, pieceCandidateId: res.candidates[0]?.id,
      pieceUrl: res.artwork.cleanedUrl, pieceAlt: res.artwork.altText, pieceSpoken: res.artwork.spokenDescription,
    });
    router.push("/create/change");
    return;
  }
  update(fresh);
  router.push("/create/pattern");
}

/** Zero pieces found: Your cutout on this photo in box mode; the box cut becomes the picked piece. */
export function drawBoxOnPhoto({ router, update }: Pick<FlowDeps, "router" | "update">, artworkId: string): void {
  update({
    ...NEW_PIECE, photoArtworkId: artworkId, candidates: [], imageSize: null,
    cutoutArtworkId: artworkId, cutout: { artworkId, candidates: [], imageSize: null, selectedIds: [], cleanedUrl: null, altText: null },
  });
  router.push("/create/cutout");
}

// ---- Choose a pattern

/**
 * "Use this" on Choose a pattern. The same piece as last time keeps its cut-out (no call) but starts
 * from the piece again (a change made before is no longer on screen); another piece is cut out with
 * `POST /artworks/{id}/select`.
 */
export async function choosePiece({ api, router, update, getDraft }: FlowDeps, artworkId: string, candidateId: string): Promise<void> {
  const d = getDraft();
  if (d.pieceArtworkId === artworkId && d.pieceCandidateId === candidateId && d.pieceUrl) {
    update({ changedArtworkId: undefined, changes: undefined, changeInstruction: undefined, changeTranscript: undefined, cutoutArtworkId: undefined, cutout: undefined });
    router.push("/create/change");
    return;
  }
  const art = await api<Artwork>(`artworks/${artworkId}/select`, { json: { candidateId } });
  update({
    ...NEW_PIECE, pieceArtworkId: art.id, pieceCandidateId: candidateId, pieceUrl: art.cleanedUrl, pieceAlt: art.altText, pieceSpoken: art.spokenDescription,
  });
  router.push("/create/change");
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

function newNonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
 * Back from Change it: Choose a pattern, also while a change is on screen (Before and after's Back
 * goes to Change it, so pointing here at Before and after made a loop). The change chain stays in
 * the draft, so "Change it again" from Before and after still works. A photo whose single piece was
 * cut out by the server never showed Choose a pattern: Back goes to the photo screen then.
 */
export function changeItBack(d: Draft): string {
  if ((d.candidates?.length ?? 0) > 1) return "/create/pattern";
  return d.method === "upload" ? "/create/photo?mode=upload" : "/create/photo?mode=camera";
}

/** "Looks good as is": the picked piece is already cut out (no call); a change result is cut on the next screen. */
export function skipChange({ router, update, getDraft }: Pick<FlowDeps, "router" | "update" | "getDraft">): void {
  const d = getDraft();
  const target = currentArtworkId(d);
  update({ cutoutArtworkId: target, cutout: pieceCutout(d) ?? (d.cutout?.artworkId === target ? d.cutout : undefined) });
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

/** The request Changing your art sends, captured on arrival. */
export function changeRequest(d: Draft): { base: string; instruction: string; transcript?: string } | null {
  const base = currentArtworkId(d);
  return base && d.changeInstruction ? { base, instruction: d.changeInstruction, transcript: d.changeTranscript } : null;
}

/** `POST /artworks/{base}/change`, then the child goes on screen and Before and after opens. */
export async function runChange({ api, router, update, getDraft }: FlowDeps, req: { base: string; instruction: string; transcript?: string }): Promise<ChangeStep> {
  const { artwork, description } = await api<ChangeResult>(`artworks/${req.base}/change`, {
    json: req.transcript ? { instruction: req.instruction, transcript: req.transcript } : { instruction: req.instruction },
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
