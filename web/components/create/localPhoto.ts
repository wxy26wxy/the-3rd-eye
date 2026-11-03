/**
 * Round 4 ruling 1: the picked photo stays on the device until "Use this area" uploads its crop. The
 * draft lives in sessionStorage, which cannot hold a file, so the file sits in this in-memory map
 * keyed by the draft's `area.photoKey`. A reload empties the map: the draft still names the key, but
 * the photo is gone and Adjust the area sends the creator back to the photo step with a notice.
 */
const photos = new Map<string, Blob>();
/** One object URL per photo (Adjust the area shows it), revoked when the photo is replaced. */
const urls = new Map<string, string>();

function revokeAll(): void {
  for (const u of urls.values()) { try { URL.revokeObjectURL(u); } catch { /* not in a browser */ } }
  urls.clear();
}

export function putPhoto(key: string, file: Blob): void {
  // One photo per tab: a new pick replaces the old one, so nothing piles up in memory.
  revokeAll();
  photos.clear();
  photos.set(key, file);
}

/** An object URL for the photo (made once per photo and kept until the photo is replaced); null without it. */
export function photoUrl(key: string | undefined): string | null {
  const file = getPhoto(key);
  if (!key || !file) return null;
  let u = urls.get(key);
  if (!u) { u = URL.createObjectURL(file); urls.set(key, u); }
  return u;
}

export function getPhoto(key: string | undefined): Blob | null {
  return key ? photos.get(key) ?? null : null;
}

export function hasPhoto(key: string | undefined): boolean {
  return !!key && photos.has(key);
}

/** Tests and sign-out: forget every photo. */
export function clearPhotos(): void {
  revokeAll();
  photos.clear();
}
