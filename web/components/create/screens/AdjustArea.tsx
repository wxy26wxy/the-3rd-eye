"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { ApiError } from "../api";
import { frameSize, initialFrame } from "../area";
import { HydratingScreen, MissingState } from "../CreateScreen";
import { usableSize, type Box, type ImageSize } from "../cutout";
import { describeError, type ScreenError } from "../errors";
import { adjustBack, cutArea } from "../flow";
import { getDraft, useCreate } from "../store";
import { useOriginal } from "../useOriginal";
import { AdjustAreaView } from "./AdjustAreaView";
import { AreaFrame } from "./AreaFrame";

const a = m.create.adjust;

/** "Frame covers 62 by 48 percent of the photo": the frame's size, said after each change and part of its description. */
export function sizeText(box: Box, image: ImageSize): string {
  const s = frameSize(box, image);
  return fmt(a.frameSize, { w: s.width, h: s.height });
}

/** A 422 for the frame is about where the frame is, not about the photo: move or grow it and try again. */
export function areaError(err: unknown): ScreenError {
  if (err instanceof ApiError && err.code === "no_drawing_found") return { message: a.notFound, action: "none" };
  return describeError(err);
}

/**
 * /create/adjust (R2): Adjust the area, between Choose a pattern and Your cutout. The frame starts on
 * the picked piece's bbox grown by 8 % (the whole photo when no drawing was found); "Use this area"
 * goes on to Making your cutout, which cuts it out (`POST /artworks/{id}/cleanup {candidateIds:[piece],
 * box, clipToBox: true}`, T130), then Your cutout.
 */
export function AdjustArea() {
  const { ready, draft } = useCreate();
  if (!ready) return <HydratingScreen title={a.title} />;
  if (!draft.area || !draft.product) return <MissingState />;
  return <AreaFlow key={`${draft.area.artworkId}:${draft.area.candidateId ?? ""}`} />;
}

function AreaFlow() {
  const router = useRouter();
  const uid = useId();
  const hintId = `${uid}-hint`;
  const sizeId = `${uid}-size`;
  const { draft, update } = useCreate();
  const area = draft.area as NonNullable<typeof draft.area>;
  const candidate = draft.candidates?.find((c) => c.id === area.candidateId) ?? null;
  const { detail, onImageError } = useOriginal(area.artworkId);
  const imageSize = detail.state === "ok" && detail.imageSize ? detail.imageSize : usableSize(draft.imageSize) ? draft.imageSize : null;
  const originalUrl = detail.state === "ok" ? detail.originalUrl : null;
  const retake = draft.method === "upload" ? "/create/photo?mode=upload" : "/create/photo?mode=camera";
  // Coming back to the same piece shows the frame it was cut with; Reset always goes to the piece's bbox.
  const returning = draft.pieceArtworkId === area.artworkId && draft.pieceCandidateId === area.candidateId ? draft.pieceBox ?? null : null;
  const [edited, setEdited] = useState<Box | null>(null);
  const [announce, setAnnounce] = useState("");
  const initial = imageSize ? initialFrame(candidate?.bbox, imageSize) : null;
  const box = edited ?? returning ?? initial;

  function say(text: string) { setAnnounce((prev) => (prev === text ? `${text} ` : text)); }
  function commit(next: Box) { if (imageSize) say(sizeText(next, imageSize)); }
  function reset() {
    if (!initial || !imageSize) return;
    setEdited(initial);
    say(`${a.resetDone}. ${sizeText(initial, imageSize)}`);
  }

  /** "Use this area": on to Making your cutout, which sends the cleanup (T130); errors show there. */
  function use() {
    if (!box) return;
    cutArea({ getDraft, update, router }, box);
  }

  return (
    <AdjustAreaView
      hintId={hintId}
      sizeId={sizeId}
      sizeText={box && imageSize ? sizeText(box, imageSize) : ""}
      back={adjustBack(draft)}
      retake={retake}
      none={!area.candidateId}
      busy={false}
      photo={imageSize && originalUrl && box ? (
        <AreaFrame
          src={originalUrl} image={imageSize} box={box} disabled={false}
          label={a.frameLabel} describedBy={`${sizeId} ${hintId}`}
          onChange={setEdited} onCommit={commit} onLimit={(k) => say(k === "small" ? a.tooSmall : a.atEdge)} onImageError={onImageError}
        />
      ) : null}
      photoState={detail.state === "loading" ? "loading" : "missing"}
      announce={announce}
      canUse={!!box}
      error={null}
      on={{ use, reset }}
    />
  );
}
