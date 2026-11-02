"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { HydratingScreen, MissingState } from "../CreateScreen";
import { usableSize } from "../cutout";
import { pickPiece } from "../flow";
import { useCreate } from "../store";
import { useOriginal } from "../useOriginal";
import { ChoosePatternView, PatternPhoto } from "./ChoosePatternView";

const t = m.create.select;

/**
 * Choose a pattern (board `2027:3254`): SAM found several drawings on the photo; the creator picks
 * one (single pick, no cutout tools) and "Use this" opens Adjust the area framed on that piece (R2;
 * the cut is made there).
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
  const [picked, setPicked] = useState(() =>
    (draft.area?.artworkId === artworkId && draft.area.candidateId) || (draft.pieceArtworkId === artworkId && draft.pieceCandidateId) || candidates[0]?.id);
  const { detail, onImageError } = useOriginal(artworkId);
  const imageSize = detail.state === "ok" && detail.imageSize ? detail.imageSize : usableSize(draft.imageSize) ? draft.imageSize : null;
  const originalUrl = detail.state === "ok" ? detail.originalUrl : null;
  const retake = draft.method === "upload" ? "/create/photo?mode=upload" : "/create/photo?mode=camera";
  const productWord = draft.product === "tote" ? m.common.tote.toLowerCase() : m.common.sticker.toLowerCase();

  function choose() {
    if (picked) pickPiece({ router, update }, artworkId, picked);
  }

  return (
    <ChoosePatternView
      lead={candidates.length === 1 ? fmt(t.copyOne, { product: productWord }) : fmt(t.copyMany, { n: candidates.length, product: productWord })}
      retake={retake}
      photo={imageSize && originalUrl ? (
        <PatternPhoto src={originalUrl} image={imageSize} candidates={candidates} picked={picked} onPick={setPicked} onImageError={onImageError} />
      ) : null}
      photoState={detail.state === "loading" ? "loading" : "missing"}
      candidates={candidates.map((c) => ({ id: c.id, thumbUrl: c.thumbUrl }))}
      picked={picked}
      on={{ pick: setPicked, use: choose }}
    />
  );
}
