/**
 * Validation of client-supplied Blob references (pure, no network). Clients may only point
 * the server at their OWN uploads in the PUBLIC store: a bare pathname under
 * `creators/<creatorId>/`, or a full URL on the public store's host with such a pathname.
 * Server-internal private pathnames (originals, masks, print files) are never accepted here.
 */
import { ApiError } from "@/lib/http";

const PATH_RE = /^creators\/[0-9a-f-]{36}\/[a-z][a-z0-9-]{0,31}\/[^/]+$/i;

/** Store id embedded in a read/write token: `vercel_blob_rw_<storeId>_<secret>`. */
export function storeIdFromToken(token: string | undefined): string | null {
  const id = token?.split("_")[3];
  return id ? id.toLowerCase() : null;
}

export function publicStoreHost(token = process.env.BLOB_READ_WRITE_TOKEN): string | null {
  const id = storeIdFromToken(token);
  return id ? `${id}.public.blob.vercel-storage.com` : null;
}

/**
 * Returns the public-store pathname for a client reference, or throws 403.
 * `ref` is a bare pathname (`creators/<id>/<kind>/<file>`) or a URL on `publicHost`.
 */
export function clientUploadPath(ref: string, creatorId: string, publicHost: string | null = publicStoreHost()): string {
  let pathname = ref.trim();
  if (/^https?:\/\//i.test(pathname)) {
    let url: URL;
    try {
      url = new URL(pathname);
    } catch {
      throw new ApiError(400, "invalid_url", "Not a valid file URL");
    }
    if (!publicHost || url.protocol !== "https:" || url.hostname.toLowerCase() !== publicHost) {
      throw new ApiError(403, "forbidden_url", "Only your own uploads can be used here");
    }
    pathname = decodeURIComponent(url.pathname.replace(/^\//, ""));
  }
  pathname = pathname.replace(/^\//, "");
  if (pathname.includes("..") || !PATH_RE.test(pathname) || !pathname.startsWith(`creators/${creatorId}/`)) {
    throw new ApiError(403, "forbidden_path", "Only your own uploads can be used here");
  }
  return pathname;
}
