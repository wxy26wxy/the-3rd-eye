"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { ApiError } from "../api";
import { frameSize, initialFrame } from "../area";
import { HydratingScreen, MissingState } from "../CreateScreen";
import { usableSize, type Box, type ImageSize } from "../cutout";
import { describeError, revealError, type ScreenError } from "../errors";
import { adjustBack, cutArea, takeNewPhoto } from "../flow";
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
  if (isNotFound(err)) return { message: a.notFound, action: "none" };
  return describeError(err);
}

/** `detect` found nothing inside the frame. */
export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.code === "no_drawing_found";
}

/**
 * /create/adjust (round 3): Adjust the area, right after the photo. The frame starts at the whole
 * stored photo (or the frame of the last cut); "Use this area" goes on to Making your cutout, which
 * detects inside the frame (`POST /artworks/{id}/detect {box}`), then Your cutout. When nothing was
 * found there, this screen says to move or grow the frame.
 */
export function AdjustArea() {
  const { ready, draft } = useCreate();
  if (!ready) return <HydratingScreen title={a.title} />;
  if (!draft.area || !draft.product) return <MissingState />;
  return <AreaFlow key={draft.area.artworkId} />;
}

function AreaFlow() {
  const router = useRouter();
  const uid = useId();
  const hintId = `${uid}-hint`;
  const sizeId = `${uid}-size`;
  const { draft, update } = useCreate();
  const area = draft.area as NonNullable<typeof draft.area>;
  const { detail, onImageError } = useOriginal(area.artworkId);
  const imageSize = detail.state === "ok" && detail.imageSize ? detail.imageSize : usableSize(draft.imageSize) ? draft.imageSize : null;
  const originalUrl = detail.state === "ok" ? detail.originalUrl : null;
  const retake = takeNewPhoto(draft);
  // Coming back to the cut photo shows the frame it was cut with; Reset always goes to the whole photo.
  const returning = draft.pieceArtworkId === area.artworkId ? draft.pieceBox ?? null : null;
  const [edited, setEdited] = useState<Box | null>(null);
  const [announce, setAnnounce] = useState("");
  const initial = imageSize ? initialFrame(undefined, imageSize) : null;
  const box = edited ?? returning ?? initial;

  // Nothing found in the frame (detect 422, review I2): focus and show the move-or-grow advice. The
  // route is kept mounted, so this runs when the screen is shown again with the flag set.
  const errorRef = useRef<HTMLDivElement>(null);
  const notFound = !!draft.areaNotFound;
  useEffect(() => { if (notFound) revealError(errorRef.current); }, [notFound]);

  function say(text: string) { setAnnounce((prev) => (prev === text ? `${text} ` : text)); }
  function commit(next: Box) {
    if (draft.areaNotFound) update({ areaNotFound: undefined });
    if (imageSize) say(sizeText(next, imageSize));
  }
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
      error={notFound ? { message: a.notFound, action: "none" } : null}
      errorRef={errorRef}
      on={{ use, reset }}
    />
  );
}
