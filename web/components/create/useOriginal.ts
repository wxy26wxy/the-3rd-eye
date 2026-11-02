"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ArtworkDetail } from "./api";
import { ORIGINAL_URL_TTL_MS, usableSize, type ImageSize } from "./cutout";

export type OriginalState = { state: "loading" } | { state: "failed" } | { state: "ok"; originalUrl: string | null; imageSize: ImageSize | null; at: number };

/**
 * The stored picture of an artwork (`GET /artworks/{id}`): the photo for a piece, the edited picture
 * for a change result. Its presigned URL lives 10 minutes, so it is fetched on mount, again after
 * ~9 minutes, and once more when the image fails to load (`onImageError`); a second failure on the
 * fresh URL gives `failed`.
 */
export function useOriginal(artworkId: string) {
  const [detail, setDetail] = useState<OriginalState>({ state: "loading" });
  const [reload, setReload] = useState(0);
  const load = useCallback(() => setReload((n) => n + 1), []);
  useEffect(() => {
    let on = true;
    api<ArtworkDetail>(`artworks/${artworkId}`)
      .then((d) => { if (on) setDetail({ state: "ok", originalUrl: d.originalUrl, imageSize: usableSize(d.imageSize) ? d.imageSize : null, at: Date.now() }); })
      .catch(() => { if (on) setDetail({ state: "failed" }); });
    return () => { on = false; };
  }, [artworkId, reload]);
  const loadedAt = detail.state === "ok" ? detail.at : null;
  useEffect(() => {
    if (loadedAt === null) return;
    const timer = setTimeout(load, Math.max(0, loadedAt + ORIGINAL_URL_TTL_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [loadedAt, load]);
  const retried = useRef<string | null>(null);
  function onImageError() {
    if (detail.state !== "ok" || !detail.originalUrl) return;
    if (retried.current === detail.originalUrl) { setDetail({ state: "failed" }); return; }
    retried.current = detail.originalUrl;
    load();
  }
  return { detail, onImageError };
}
