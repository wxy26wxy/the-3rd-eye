/** Storage abstraction. Only lib/storage talks to Vercel Blob. */
export type StoredFile = {
  /** Logical pathname to keep in the database (private files are served via `/media/<pathname>`). */
  pathname: string;
  /** Direct URL. Public for putPublic; for putPrivate it is not meant to be shown to clients. */
  url: string;
};

export type PutBody = Buffer | Uint8Array | Blob | string;

export type PrivateStream = { stream: ReadableStream<Uint8Array>; contentType: string; size: number };

export interface Storage {
  putPublic(path: string, data: PutBody, contentType: string): Promise<StoredFile>;
  putPrivate(path: string, data: PutBody, contentType: string): Promise<StoredFile>;
  getPrivateStream(path: string): Promise<PrivateStream | null>;
  /** Short-lived URL a client can fetch directly (supports HTTP range requests for video). */
  signedUrl(path: string, ttlSeconds: number): Promise<string | null>;
  delete(path: string): Promise<void>;
  /** Reads a file the server itself stored or chose (internal references only; may hit the private store). */
  read(urlOrPathname: string): Promise<Buffer>;
  /** Reads a PUBLIC-store pathname (client uploads). Throws 413 above `maxBytes`, 404 when missing. */
  readPublic(pathname: string, maxBytes?: number): Promise<Buffer>;
}
