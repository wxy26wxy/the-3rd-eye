import { checkAdminAuth, optionalCreator } from "@/lib/auth";
import { errorResponse, route } from "@/lib/http";
import { getOrderIdForToken } from "@/lib/db/queries";
import { isNfcToken, normalizeNfcToken } from "@/lib/ids";
import { storage } from "@/lib/storage";

const TTL_SECONDS = 600;

async function allowedCreatorId(req: Request): Promise<string | "admin" | null> {
  if (checkAdminAuth(req.headers.get("authorization"))) return "admin";
  const creatorId = optionalCreator(req);
  if (creatorId) return creatorId;
  const t = new URL(req.url).searchParams.get("t");
  if (t) {
    const token = normalizeNfcToken(t);
    if (isNfcToken(token)) return (await getOrderIdForToken(token))?.creatorId ?? null;
  }
  return null;
}

/**
 * Private files: creator auth (own files), `?t=<nfc token>` (files of that order's creator),
 * or admin basic auth. Redirects to a short-lived URL (keeps HTTP range requests working
 * for video); streams when no URL can be signed.
 */
export const GET = route<{ params: Promise<{ path: string[] }> }>(async (req, { params }) => {
  const { path } = await params;
  const pathname = path.map(decodeURIComponent).join("/");
  if (pathname.includes("..")) return errorResponse(400, "invalid_path", "Invalid path");
  const who = await allowedCreatorId(req);
  if (!who) return errorResponse(401, "unauthorized", "Not allowed");
  if (who !== "admin" && !pathname.startsWith(`creators/${who}/`)) return errorResponse(403, "forbidden", "Not allowed");
  const signed = await storage().signedUrl(pathname, TTL_SECONDS);
  if (signed) return new Response(null, { status: 302, headers: { Location: signed, "Cache-Control": "private, no-store" } });
  const file = await storage().getPrivateStream(pathname);
  if (!file) return errorResponse(404, "not_found", "File not found");
  return new Response(file.stream, { headers: { "Content-Type": file.contentType, "Content-Length": String(file.size), "Cache-Control": "private, no-store" } });
});
