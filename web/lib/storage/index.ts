import "server-only";
import { randomUUID } from "node:crypto";
import { BlobStorage } from "./blob";
import { clientUploadPath } from "./refs";
import type { Storage } from "./types";

export type { Storage, StoredFile, PrivateStream, PutBody } from "./types";
export { clientUploadPath, publicStoreHost } from "./refs";

let _storage: Storage | null = null;
export function storage(): Storage {
  if (!_storage) _storage = new BlobStorage();
  return _storage;
}

/** Test seam: swap the implementation (e.g. an in-memory store). */
export function setStorage(s: Storage | null): void {
  _storage = s;
}

/** `creators/<creatorId>/<kind>/<uuid>.<ext>` — the pathname scheme from docs/api.md. */
export function creatorPath(creatorId: string, kind: string, ext: string): string {
  return `creators/${creatorId}/${kind}/${randomUUID()}.${ext.replace(/^\./, "")}`;
}

/** True when `pathname` belongs to the creator (used by uploads and /media authorization). */
export function isCreatorPath(pathname: string, creatorId: string): boolean {
  return pathname.startsWith(`creators/${creatorId}/`) && !pathname.includes("..");
}

/** Reads a client-supplied reference after checking it is the creator's own public upload. */
export function readClientUpload(ref: string, creatorId: string, maxBytes?: number): Promise<Buffer> {
  return storage().readPublic(clientUploadPath(ref, creatorId), maxBytes);
}
