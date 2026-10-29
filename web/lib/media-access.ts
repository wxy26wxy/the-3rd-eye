/**
 * Who may read `/media/<pathname>` (pure; docs/api.md "Clarifications" 1):
 * - anyone: public kinds (`creators/<id>/{mockups|cleaned|thumbs|avatar|story-video}/…`) and a creator's current story video;
 * - admin (basic auth): everything, including print PNG / die-cut SVG;
 * - a creator: their own files;
 * - `?tag=<nfc token>`: only that order's thank-you media.
 */
export const PUBLIC_KINDS = new Set(["mockups", "cleaned", "thumbs", "avatar", "story-video"]);

export type MediaRequest = {
  pathname: string;
  isAdmin: boolean;
  creatorId: string | null;
  tagFiles: string[] | null;
  isStoryVideo: boolean;
};

export function isPublicKind(pathname: string): boolean {
  const parts = pathname.split("/");
  return parts[0] === "creators" && parts.length >= 4 && PUBLIC_KINDS.has(parts[2]);
}

export function canReadMedia(r: MediaRequest): boolean {
  if (!r.pathname || r.pathname.includes("..") || r.pathname.startsWith("/")) return false;
  if (isPublicKind(r.pathname) || r.isAdmin || r.isStoryVideo) return true;
  if (r.creatorId && r.pathname.startsWith(`creators/${r.creatorId}/`)) return true;
  return Boolean(r.tagFiles?.includes(r.pathname));
}
