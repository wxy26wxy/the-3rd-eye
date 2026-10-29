/**
 * Vercel Blob implementation of Storage.
 * - Public store: BLOB_READ_WRITE_TOKEN.
 * - Private store: selected by BLOB_PRIVATE_STORE_ID with OIDC credentials (the SDK reads
 *   VERCEL_OIDC_TOKEN locally; on Vercel the credential is automatic). Private stores have no
 *   read/write token. Only when BLOB_PRIVATE_STORE_ID is absent, private files go to the
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

type Creds = { token?: string; storeId?: string };

function publicCreds(): Creds {
  return { token: process.env.BLOB_READ_WRITE_TOKEN };
}
/** Private-store credentials (OIDC + store id), or null when the private store is not configured. */
function privateCreds(): Creds | null {
  const storeId = process.env.BLOB_PRIVATE_STORE_ID;
  if (!storeId && !warned) {
    warned = true;
    console.warn("[storage] BLOB_PRIVATE_STORE_ID missing: private files use hashed pathnames in the public store");
  }
  return storeId ? { storeId } : null;
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
    const res = await put(pathname, toBody(data), { access: "public", contentType, ...publicCreds(), allowOverwrite: false });
    return { pathname: res.pathname, url: res.url };
  }

  async putPrivate(path: string, data: PutBody, contentType: string): Promise<StoredFile> {
    const priv = privateCreds();
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
    const priv = privateCreds();
    const list: { pathname: string; access: "public" | "private"; creds: Creds }[] = priv
      ? [{ pathname: path, access: "private", creds: priv }]
      : [{ pathname: hashedPathname(path), access: "public", creds: publicCreds() }];
    list.push({ pathname: path, access: "public", creds: publicCreds() });
    return list;
  }

  async getPrivateStream(path: string): Promise<PrivateStream | null> {
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
        const res = await get(urlOrPathname, { access: "private", ...(privateCreds() ?? {}) });
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
