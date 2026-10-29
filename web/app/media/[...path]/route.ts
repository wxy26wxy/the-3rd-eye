import { checkAdminAuth, optionalCreator } from "@/lib/auth";
import { errorResponse, route } from "@/lib/http";
import { getOrderIdForToken, isStoryVideoPath } from "@/lib/db/queries";
import { isNfcToken, normalizeNfcToken } from "@/lib/ids";
import { storage } from "@/lib/storage";

const TTL_SECONDS = 600;
/** Path kinds that are public by design (`creators/<id>/<kind>/...`). */
const PUBLIC_KINDS = new Set(["mockups", "cleaned", "thumbs", "avatar", "story-video"]);

/**
 * Access rule (docs/api.md "Clarifications"):
 * - public: a creator's current story video, and public kinds (mockups, cleaned, thumbs, avatar, story-video);
 * - `?tag=<nfc token>` (or `?t=`): any file of that order's creator (thank-you media on story-tag pages);
 * - creator auth: the creator's own files; admin basic auth: everything (print PNG / die-cut SVG).
 */
async function allowed(req: Request, pathname: string): Promise<boolean> {
  const parts = pathname.split("/");
  if (parts[0] === "creators" && PUBLIC_KINDS.has(parts[2] ?? "")) return true;
  if (checkAdminAuth(req.headers.get("authorization"))) return true;
  const ownerPrefix = (id: string) => pathname.startsWith(`creators/${id}/`);
  const creatorId = optionalCreator(req);
  if (creatorId && ownerPrefix(creatorId)) return true;
  const params = new URL(req.url).searchParams;
  const tag = params.get("tag") ?? params.get("t");
  if (tag) {
    const token = normalizeNfcToken(tag);
    const order = isNfcToken(token) ? await getOrderIdForToken(token) : null;
    if (order && ownerPrefix(order.creatorId)) return true;
  }
  return isStoryVideoPath(pathname);
}

/** Redirects to a short-lived URL (keeps HTTP range requests working for video); streams when none can be signed. */
export const GET = route<{ params: Promise<{ path: string[] }> }>(async (req, { params }) => {
  const { path } = await params;
  const pathname = path.map(decodeURIComponent).join("/");
  if (pathname.includes("..")) return errorResponse(400, "invalid_path", "Invalid path");
  if (!(await allowed(req, pathname))) return errorResponse(401, "unauthorized", "Not allowed");
  const signed = await storage().signedUrl(pathname, TTL_SECONDS);
  if (signed) return new Response(null, { status: 302, headers: { Location: signed, "Cache-Control": "private, no-store" } });
  const file = await storage().getPrivateStream(pathname);
  if (!file) return errorResponse(404, "not_found", "File not found");
  return new Response(file.stream, { headers: { "Content-Type": file.contentType, "Content-Length": String(file.size), "Cache-Control": "private, no-store" } });
});
