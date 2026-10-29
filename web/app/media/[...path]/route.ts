import { checkAdminAuth, optionalCreator } from "@/lib/auth";
import { errorResponse, route } from "@/lib/http";
import { getTagMediaPaths, isStoryVideoPath } from "@/lib/db/queries";
import { isNfcToken, normalizeNfcToken } from "@/lib/ids";
import { canReadMedia, isPublicKind } from "@/lib/media-access";
import { storage } from "@/lib/storage";

const TTL_SECONDS = 600;

/**
 * Private and public media by logical pathname; access rules in lib/media-access.ts.
 * Redirects to a short-lived URL (keeps HTTP range requests working for video); streams when none can be signed.
 */
export const GET = route<{ params: Promise<{ path: string[] }> }>(async (req, { params }) => {
  const { path } = await params; // already decoded by Next; do not decode again
  const pathname = path.join("/");
  if (!pathname || pathname.includes("..")) return errorResponse(400, "invalid_path", "Invalid path");

  const isAdmin = checkAdminAuth(req.headers.get("authorization"));
  const creatorId = optionalCreator(req);
  const search = new URL(req.url).searchParams;
  const tag = search.get("tag") ?? search.get("t");
  const quick = canReadMedia({ pathname, isAdmin, creatorId, tagFiles: null, isStoryVideo: false });
  let allowed = quick;
  if (!allowed && tag) {
    const token = normalizeNfcToken(tag);
    const files = isNfcToken(token) ? await getTagMediaPaths(token) : null;
    allowed = canReadMedia({ pathname, isAdmin, creatorId, tagFiles: files, isStoryVideo: false });
  }
  if (!allowed && !isPublicKind(pathname)) {
    allowed = canReadMedia({ pathname, isAdmin, creatorId, tagFiles: null, isStoryVideo: await isStoryVideoPath(pathname) });
  }
  if (!allowed) return errorResponse(creatorId || isAdmin || tag ? 403 : 401, "forbidden", "Not allowed");

  const signed = await storage().signedUrl(pathname, TTL_SECONDS);
  if (signed) return new Response(null, { status: 302, headers: { Location: signed, "Cache-Control": "private, no-store" } });
  const file = await storage().getPrivateStream(pathname);
  if (!file) return errorResponse(404, "not_found", "File not found");
  return new Response(file.stream, { headers: { "Content-Type": file.contentType, "Content-Length": String(file.size), "Cache-Control": "private, no-store" } });
});
