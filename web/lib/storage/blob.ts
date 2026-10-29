/**
 * Vercel Blob implementation of Storage.
 * - Public store: BLOB_READ_WRITE_TOKEN.
 * - Private store: BLOB_PRIVATE_READ_WRITE_TOKEN. Until it is linked, private files go to the
 *   public store under `private/<sha256(pathname)>.<ext>` (unguessable because every logical
 *   pathname contains a random uuid). The database always keeps the logical pathname.
 * - Write-once: an existing pathname is never overwritten; a new suffixed pathname is written instead.
 */
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { del, get, head, issueSignedToken, presignUrl, put, BlobNotFoundError } from "@vercel/blob";
import type { PrivateStream, PutBody, Storage, StoredFile } from "./types";

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";
let warned = false;

function publicToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}
function privateToken(): string | undefined {
  const t = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
  if (!t && !warned) {
    warned = true;
    console.warn("[storage] BLOB_PRIVATE_READ_WRITE_TOKEN missing: private files use hashed pathnames in the public store");
  }
  return t;
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

async function exists(pathname: string, token: string | undefined): Promise<boolean> {
  try {
    await head(pathname, { token });
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
    for (let i = 0; i < 3 && (await exists(pathname, publicToken())); i++) pathname = withSuffix(path);
    const res = await put(pathname, toBody(data), { access: "public", contentType, token: publicToken(), allowOverwrite: false });
    return { pathname: res.pathname, url: res.url };
  }

  async putPrivate(path: string, data: PutBody, contentType: string): Promise<StoredFile> {
    const token = privateToken();
    const physical = (logical: string) => (token ? logical : hashedPathname(logical));
    const physToken = token ?? publicToken();
    let logical = path;
    for (let i = 0; i < 3 && (await exists(physical(logical), physToken)); i++) logical = withSuffix(path);
    const res = await put(physical(logical), toBody(data), {
      access: token ? "private" : "public", contentType, token: physToken, allowOverwrite: false,
    });
    return { pathname: logical, url: res.url };
  }

  /** Where a logical pathname physically lives. Client uploads are stored directly under their logical name. */
  private candidates(path: string): { pathname: string; access: "public" | "private"; token: string | undefined }[] {
    const token = privateToken();
    const list: { pathname: string; access: "public" | "private"; token: string | undefined }[] = token
      ? [{ pathname: path, access: "private", token }]
      : [{ pathname: hashedPathname(path), access: "public", token: publicToken() }];
    list.push({ pathname: path, access: "public", token: publicToken() });
    return list;
  }

  async getPrivateStream(path: string): Promise<PrivateStream | null> {
    for (const c of this.candidates(path)) {
      try {
        const res = await get(c.pathname, { access: c.access, token: c.token });
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
          if (!(await exists(c.pathname, c.token))) continue;
          const validUntil = Date.now() + ttlSeconds * 1000;
          const signed = await issueSignedToken({ pathname: c.pathname, operations: ["get"], validUntil, token: c.token });
          const { presignedUrl } = await presignUrl(signed, { operation: "get", pathname: c.pathname, access: "private", validUntil });
          return presignedUrl;
        }
        const meta = await head(c.pathname, { token: c.token });
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
        await del(c.pathname, { token: c.token });
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
        const res = await get(urlOrPathname, { access: "private", token: privateToken() });
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
}
