"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { api } from "../api";
import { HydratingScreen, MissingState } from "../CreateScreen";
import { usableSize } from "../cutout";
import { describeError, type ScreenError } from "../errors";
import { busyWhile, choosePiece } from "../flow";
import { getDraft, useCreate } from "../store";
import { useOriginal } from "../useOriginal";
import { ChoosePatternView, PatternPhoto } from "./ChoosePatternView";

const t = m.create.select;

/**
 * Choose a pattern (board `2027:3254`): SAM found several drawings on the photo; the creator picks
 * one (single pick, no cutout tools) and "Use this" cuts that piece out (`POST /artworks/{id}/select`)
 * and goes on to Change it.
 */
export function ChoosePattern() {
  const { ready, draft } = useCreate();
  if (!ready) return <HydratingScreen title={t.title} />;
  if (!draft.photoArtworkId || !draft.candidates?.length || !draft.product) return <MissingState />;
  return <PatternFlow key={draft.photoArtworkId} />;
}

function PatternFlow() {
  const router = useRouter();
  const { draft, update } = useCreate();
  const artworkId = draft.photoArtworkId as string;
  const candidates = draft.candidates ?? [];
  const [picked, setPicked] = useState(() => (draft.pieceArtworkId === artworkId && draft.pieceCandidateId) || candidates[0]?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ScreenError | null>(null);
  const { detail, onImageError } = useOriginal(artworkId);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const imageSize = detail.state === "ok" && detail.imageSize ? detail.imageSize : usableSize(draft.imageSize) ? draft.imageSize : null;
  const originalUrl = detail.state === "ok" ? detail.originalUrl : null;
  const retake = draft.method === "upload" ? "/create/photo?mode=upload" : "/create/photo?mode=camera";
  const productWord = draft.product === "tote" ? m.common.tote.toLowerCase() : m.common.sticker.toLowerCase();

  async function choose() {
    if (!picked || busy) return;
    setError(null);
    // Cleared after navigating too: this route stays mounted, and Back must find Use this enabled.
    await busyWhile(setBusy, true, false, async () => {
      try {
        await choosePiece({
          api, getDraft,
          update: (patch) => { if (live.current) update(patch); },
          router: { push: (h) => { if (live.current) router.push(h); }, replace: (h) => { if (live.current) router.replace(h); } },
        }, artworkId, picked);
      } catch (err) {
        if (live.current) setError(describeError(err));
      }
    });
  }

  return (
    <ChoosePatternView
      lead={candidates.length === 1 ? fmt(t.copyOne, { product: productWord }) : fmt(t.copyMany, { n: candidates.length, product: productWord })}
      retake={retake}
      busy={busy}
      photo={imageSize && originalUrl ? (
        <PatternPhoto src={originalUrl} image={imageSize} candidates={candidates} picked={picked} disabled={busy} onPick={setPicked} onImageError={onImageError} />
      ) : null}
      photoState={detail.state === "loading" ? "loading" : "missing"}
      candidates={candidates.map((c) => ({ id: c.id, thumbUrl: c.thumbUrl }))}
      picked={picked}
      error={error}
      on={{ pick: setPicked, use: () => void choose() }}
    />
  );
}
