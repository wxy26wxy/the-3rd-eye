/**
 * Vercel Blob implementation of Storage.
 * - Public store: BLOB_READ_WRITE_TOKEN.
 * - Private store: selected by BLOB_PRIVATE_STORE_ID with OIDC credentials (the SDK reads
 *   VERCEL_OIDC_TOKEN locally; on Vercel the credential is automatic). A read/write token is used
 *   instead only when one belongs to that store (BLOB_PRIVATE_READ_WRITE_TOKEN, or
 *   BLOB_READ_WRITE_TOKEN if it is the private store's); the public store's token never is. When
 *   the local OIDC token is missing or expired, the SDK falls back to the public token and the
 *   store answers "Cannot use private access on a public store": that is reported as
 *   503 storage_credentials_expired with the neutral STORAGE_UNAVAILABLE message; the
 *   `vercel env pull` hint goes to the server log only, once. Only when BLOB_PRIVATE_STORE_ID is absent, private files go to the
 *   public store under `private/<sha256(pathname)>.<ext>` (unguessable because every logical
 *   pathname contains a random uuid). The database always keeps the logical pathname.
 * - Write-once: an existing pathname is never overwritten; a new suffixed pathname is written instead.
 */
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { del, get, head, issueSignedToken, presignUrl, put, BlobNotFoundError } from "@vercel/blob";
import type { PrivateStream, PutBody, Storage, StoredFile } from "./types";
import { ApiError } from "@/lib/http";

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";
let warned = false;
let warnedCreds = false;

type Creds = { token?: string; storeId?: string };
type Env = Record<string, string | undefined>;

/** `cache-control` max-age of public files, in seconds: one year (every public pathname is written once). */
export const PUBLIC_CACHE_MAX_AGE = 365 * 24 * 60 * 60;

/** Message the client gets when the private store cannot be reached with the server's credentials. */
export const STORAGE_UNAVAILABLE = "Storage is unavailable; try again later.";
/** One-time server log line for the same case (local credentials; never shown to clients). */
export const STORAGE_CREDENTIALS_HINT = "Storage credentials expired; run `vercel env pull`";

const normalizeStoreId = (id: string) => id.trim().replace(/^store_/, "");
/** Store id inside a read/write token (`vercel_blob_rw_<storeId>_<secret>`), as the SDK parses it. */
const tokenStoreId = (token: string) => normalizeStoreId(token.split("_")[3] ?? "");

/** "ok", "missing" or "expired" for VERCEL_OIDC_TOKEN (exp read from the JWT payload; nothing printed). */
export function oidcTokenState(env: Env = process.env, now = Date.now()): "ok" | "missing" | "expired" {
  const token = env.VERCEL_OIDC_TOKEN?.trim();
  if (!token) return "missing";
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp * 1000 <= now ? "expired" : "ok";
  } catch {
    return "ok"; // not a JWT we can read: let the SDK decide
  }
}

function publicCreds(): Creds {
  return { token: process.env.BLOB_READ_WRITE_TOKEN };
}
/**
 * Private-store credentials, or null when the private store is not configured. A read/write token
 * whose store id is the private store's wins (BLOB_PRIVATE_READ_WRITE_TOKEN, then
 * BLOB_READ_WRITE_TOKEN); otherwise OIDC with the store id. A token of another store is never used.
 */
export function privateCreds(env: Env = process.env): Creds | null {
  const storeId = env.BLOB_PRIVATE_STORE_ID?.trim();
  if (!storeId) {
    if (!warned) {
      warned = true;
      console.warn("[storage] BLOB_PRIVATE_STORE_ID missing: private files use hashed pathnames in the public store");
    }
    return null;
  }
  for (const name of ["BLOB_PRIVATE_READ_WRITE_TOKEN", "BLOB_READ_WRITE_TOKEN"]) {
    const token = env[name]?.trim();
    if (token && tokenStoreId(token) === normalizeStoreId(storeId)) return { token };
  }
  return { storeId };
}

/**
 * Maps the SDK's errors for missing or expired private-store credentials to a clear ApiError
 * (503 storage_credentials_expired), logged once; any other error is returned unchanged.
 */
export function storageError(err: unknown, env: Env = process.env): unknown {
  const message = err instanceof Error ? err.message : "";
  if (!/private access on a public store|no blob credentials found/i.test(message)) return err;
  return credentialsExpired(env);
}

function credentialsExpired(env: Env): ApiError {
  if (!warnedCreds) {
    warnedCreds = true;
    console.error(`[storage] ${STORAGE_CREDENTIALS_HINT} (VERCEL_OIDC_TOKEN ${oidcTokenState(env)}; see docs/rewind.md)`);
  }
  return new ApiError(503, "storage_credentials_expired", STORAGE_UNAVAILABLE);
}

/**
 * privateCreds(), checked before any SDK call: locally (no `VERCEL` env), OIDC credentials with a
 * missing or expired VERCEL_OIDC_TOKEN throw the 503 at once. Otherwise the SDK would quietly use
 * the public token, and reads (head, get, signed URLs) would answer "not found" from the public
 * store instead. On Vercel the credential comes with the request, so nothing is checked there.
 */
export function usablePrivateCreds(env: Env = process.env): Creds | null {
  const creds = privateCreds(env);
  if (creds && !creds.token && !env.VERCEL && oidcTokenState(env) !== "ok") throw credentialsExpired(env);
  return creds;
}

/** Runs a private-store call, reporting credential failures as the 503 storage_credentials_expired. */
async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw storageError(err);
  }
}

function extOf(path: string): string {
  const m = /\.[a-z0-9]{1,5}$/i.exec(path);
  return m ? m[0].toLowerCase() : "";
}

export function hashedPathname(logical: string): string {
  return `private/${createHash("sha256").update(logical).digest("hex")}${extOf(logical)}`;
}

function withSuffix(path: string): string {
  const ext = extOf(path);
  const base = ext ? path.slice(0, -ext.length) : path;
  return `${base}-${randomBytes(4).toString("hex")}${ext}`;
}

async function exists(pathname: string, creds: Creds): Promise<boolean> {
  try {
    await head(pathname, creds);
    return true;
  } catch (err) {
    if (err instanceof BlobNotFoundError) return false;
    throw err;
  }
}

function toBody(data: PutBody): Buffer | Blob | string {
  return data instanceof Uint8Array && !Buffer.isBuffer(data) ? Buffer.from(data) : (data as Buffer | Blob | string);
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

export class BlobStorage implements Storage {
  async putPublic(path: string, data: PutBody, contentType: string): Promise<StoredFile> {
    let pathname = path;
    for (let i = 0; i < 3 && (await exists(pathname, publicCreds())); i++) pathname = withSuffix(path);
    // Write-once pathnames (never overwritten), so browsers and the apps may keep a public file a year (T143).
    const res = await put(pathname, toBody(data), { access: "public", contentType, ...publicCreds(), allowOverwrite: false, cacheControlMaxAge: PUBLIC_CACHE_MAX_AGE });
    return { pathname: res.pathname, url: res.url };
  }

  async putPrivate(path: string, data: PutBody, contentType: string): Promise<StoredFile> {
    return guarded(() => this.putPrivateRaw(path, data, contentType));
  }

  private async putPrivateRaw(path: string, data: PutBody, contentType: string): Promise<StoredFile> {
    const priv = usablePrivateCreds();
    const physical = (logical: string) => (priv ? logical : hashedPathname(logical));
    const creds = priv ?? publicCreds();
    let logical = path;
    for (let i = 0; i < 3 && (await exists(physical(logical), creds)); i++) logical = withSuffix(path);
    const res = await put(physical(logical), toBody(data), {
      access: priv ? "private" : "public", contentType, ...creds, allowOverwrite: false,
    });
    return { pathname: logical, url: res.url };
  }

  /** Where a logical pathname physically lives. Client uploads are stored directly under their logical name. */
  private candidates(path: string): { pathname: string; access: "public" | "private"; creds: Creds }[] {
    const priv = usablePrivateCreds();
    const list: { pathname: string; access: "public" | "private"; creds: Creds }[] = priv
      ? [{ pathname: path, access: "private", creds: priv }]
      : [{ pathname: hashedPathname(path), access: "public", creds: publicCreds() }];
    list.push({ pathname: path, access: "public", creds: publicCreds() });
    return list;
  }

  async getPrivateStream(path: string): Promise<PrivateStream | null> {
    return guarded(() => this.getPrivateStreamRaw(path));
  }

  private async getPrivateStreamRaw(path: string): Promise<PrivateStream | null> {
    for (const c of this.candidates(path)) {
      try {
        const res = await get(c.pathname, { access: c.access, ...c.creds });
        if (res && res.statusCode === 200) return { stream: res.stream, contentType: res.blob.contentType, size: res.blob.size };
      } catch (err) {
        if (!(err instanceof BlobNotFoundError)) throw err;
      }
    }
    return null;
  }

  async signedUrl(path: string, ttlSeconds: number): Promise<string | null> {
    return guarded(() => this.signedUrlRaw(path, ttlSeconds));
  }

  private async signedUrlRaw(path: string, ttlSeconds: number): Promise<string | null> {
    for (const c of this.candidates(path)) {
      try {
        if (c.access === "private") {
          if (!(await exists(c.pathname, c.creds))) continue;
          const validUntil = Date.now() + ttlSeconds * 1000;
          const signed = await issueSignedToken({ pathname: c.pathname, operations: ["get"], validUntil, ...c.creds });
          const { presignedUrl } = await presignUrl(signed, { operation: "get", pathname: c.pathname, access: "private", validUntil });
          return presignedUrl;
        }
        const meta = await head(c.pathname, c.creds);
        return meta.url;
      } catch (err) {
        if (!(err instanceof BlobNotFoundError)) throw err;
      }
    }
    return null;
  }

  async delete(path: string): Promise<void> {
    return guarded(() => this.deleteRaw(path));
  }

  private async deleteRaw(path: string): Promise<void> {
    for (const c of this.candidates(path)) {
      try {
        await del(c.pathname, c.creds);
      } catch (err) {
        if (!(err instanceof BlobNotFoundError)) throw err;
      }
    }
  }

  async read(urlOrPathname: string): Promise<Buffer> {
    if (/^https?:\/\//.test(urlOrPathname)) {
      const url = new URL(urlOrPathname);
      if (!url.hostname.endsWith(BLOB_HOST_SUFFIX)) throw new Error("Only Vercel Blob URLs can be read");
      if (url.hostname.includes(".private.")) {
        const res = await guarded(() => get(urlOrPathname, { access: "private", ...(usablePrivateCreds() ?? {}) }));
        if (!res || res.statusCode !== 200) throw new Error("Blob not found");
        return streamToBuffer(res.stream);
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Blob fetch failed: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    }
    const pathname = urlOrPathname.replace(/^\/?(media\/)?/, "");
    const priv = await this.getPrivateStream(pathname);
    if (!priv) throw new Error(`Blob not found: ${pathname}`);
    return streamToBuffer(priv.stream);
  }

  async readPublic(pathname: string, maxBytes = 200 * 1024 * 1024): Promise<Buffer> {
    let size: number;
    try {
      size = (await head(pathname, publicCreds())).size;
    } catch (err) {
      if (err instanceof BlobNotFoundError) throw new ApiError(404, "file_not_found", "That upload was not found");
      throw err;
    }
    if (size > maxBytes) throw new ApiError(413, "too_large", "That file is too large");
    const res = await get(pathname, { access: "public", ...publicCreds() });
    if (!res || res.statusCode !== 200) throw new ApiError(404, "file_not_found", "That upload was not found");
    return streamToBuffer(res.stream);
  }
}
