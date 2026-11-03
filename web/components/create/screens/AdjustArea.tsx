"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { api, ApiError } from "../api";
import { frameSize, initialFrame } from "../area";
import { HydratingScreen, MissingState } from "../CreateScreen";
import { CropError } from "../crop";
import { usableSize, type Box, type ImageSize } from "../cutout";
import { describeError, revealError, type ScreenError } from "../errors";
import { adjustBack, areaFrame, cutArea, discardNotFoundRow, hasLocalPhoto, photoGone, sameNotFound, takeNewPhoto } from "../flow";
import { photoUrl } from "../localPhoto";
import { getDraft, useCreate } from "../store";
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
  if (err instanceof CropError) return { message: m.create.photo.cannotOpen, action: "none" };
  return describeError(err);
}

/** The crop had no drawing in it. */
export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.code === "no_drawing_found";
}

/**
 * /create/adjust (round 4 ruling 1): Adjust the area on the photo still on the device (no upload,
 * no call). The frame starts at the whole photo (or the last frame used); "Use this area" goes on
 * to Making your cutout, which crops the photo to the frame, uploads the crop and sends `POST
 * /artworks` on it. When the crop had nothing in it, this screen says to move or grow the frame.
 * After a reload the photo is gone: the photo step, with a notice.
 */
export function AdjustArea() {
  const { ready, draft } = useCreate();
  if (!ready) return <HydratingScreen title={a.title} />;
  if (!draft.area || !draft.product) return <MissingState />;
  if (!hasLocalPhoto(draft)) return <PhotoGone />;
  return <AreaFlow key={draft.area.photoKey} />;
}

/** The local photo was lost (a reload): on to the photo step, which says so. */
function PhotoGone() {
  const router = useRouter();
  const { update } = useCreate();
  // Checked again when the effect runs: the kept-mounted route (cacheComponents) re-runs this effect
  // when it is shown again, possibly before it re-renders with a newly picked photo.
  useEffect(() => {
    const d = getDraft();
    if (d.area && !hasLocalPhoto(d)) photoGone({ router, update }, d);
  }, [router, update]);
  return <HydratingScreen title={a.title} />;
}

function AreaFlow() {
  const router = useRouter();
  const uid = useId();
  const hintId = `${uid}-hint`;
  const sizeId = `${uid}-size`;
  const { draft, update } = useCreate();
  const area = draft.area as NonNullable<typeof draft.area>;
  const src = photoUrl(area.photoKey);
  const [failed, setFailed] = useState(false);
  const imageSize = usableSize(area.size) ? area.size : null;
  const retake = takeNewPhoto(draft);
  // The last frame used on this photo (Back from Your cutout, a redo); Reset always goes to the whole photo.
  const returning = areaFrame(draft);
  const [edited, setEdited] = useState<Box | null>(null);
  const [announce, setAnnounce] = useState("");
  const initial = imageSize ? initialFrame(undefined, imageSize) : null;
  const box = edited ?? returning ?? initial;

  // Nothing found in the crop (422): focus and show the move-or-grow advice. The route is kept
  // mounted, so this runs when the screen is shown again with the flag set.
  const errorRef = useRef<HTMLDivElement>(null);
  const notFound = !!draft.areaNotFound;
  useEffect(() => { if (notFound) revealError(errorRef.current); }, [notFound]);

  function say(text: string) { setAnnounce((prev) => (prev === text ? `${text} ` : text)); }
  function commit(next: Box) {
    if (draft.areaNotFound && !sameNotFound(draft, next)) update({ areaNotFound: undefined });
    if (imageSize) say(sizeText(next, imageSize));
  }
  function reset() {
    if (!initial || !imageSize) return;
    setEdited(initial);
    commit(initial);
    say(`${a.resetDone}. ${sizeText(initial, imageSize)}`);
  }

  /** "Use this area": on to Making your cutout, which crops, uploads and creates the row; errors show there. */
  function use() {
    if (!box) return;
    if (!cutArea({ api, getDraft, update, router }, box)) revealError(errorRef.current);
  }

  return (
    <AdjustAreaView
      hintId={hintId}
      sizeId={sizeId}
      sizeText={box && imageSize ? sizeText(box, imageSize) : ""}
      back={adjustBack(draft)}
      retake={retake}
      onRetake={() => discardNotFoundRow({ api, getDraft, update })}
      busy={false}
      photo={imageSize && src && box && !failed ? (
        <AreaFrame
          src={src} image={imageSize} box={box} disabled={false}
          label={a.frameLabel} describedBy={`${sizeId} ${hintId}`}
          onChange={setEdited} onCommit={commit} onLimit={(k) => say(k === "small" ? a.tooSmall : a.atEdge)} onImageError={() => setFailed(true)}
        />
      ) : null}
      photoState={failed ? "missing" : "loading"}
      announce={announce}
      canUse={!!box}
      error={notFound ? { message: a.notFound, action: "none" } : null}
      errorRef={errorRef}
      on={{ use, reset }}
    />
  );
}
