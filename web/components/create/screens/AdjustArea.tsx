"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { api, ApiError } from "../api";
import { frameSize, initialFrame } from "../area";
import { HydratingScreen, MissingState } from "../CreateScreen";
import { usableSize, type Box, type ImageSize } from "../cutout";
import { describeError, type ScreenError } from "../errors";
import { adjustBack, busyWhile, cutArea } from "../flow";
import { getDraft, useCreate } from "../store";
import { useOriginal } from "../useOriginal";
import { AdjustAreaView } from "./AdjustAreaView";
import { AreaFrame } from "./AreaFrame";

const a = m.create.adjust;

/** "62 % of the width and 48 % of the height": the frame's size for the live region and the frame's name. */
export function sizeText(box: Box, image: ImageSize): string {
  const s = frameSize(box, image);
  return fmt(a.size, { w: s.width, h: s.height });
}

/** A 422 for the frame is about where the frame is, not about the photo: move or grow it and try again. */
export function areaError(err: unknown): ScreenError {
  if (err instanceof ApiError && err.code === "no_drawing_found") return { message: a.notFound, action: "none" };
  return describeError(err);
}

/**
 * /create/adjust (R2): Adjust the area, between Choose a pattern and Change it. The frame starts on
 * the picked piece's bbox grown by 8 % (the whole photo when no drawing was found); "Use this area"
 * cuts it out (`POST /artworks/{id}/cleanup {candidateIds:[piece], box}`) and goes on to Change it.
 */
export function AdjustArea() {
  const { ready, draft } = useCreate();
  if (!ready) return <HydratingScreen title={a.title} />;
  if (!draft.area || !draft.product) return <MissingState />;
  return <AreaFlow key={`${draft.area.artworkId}:${draft.area.candidateId ?? ""}`} />;
}

function AreaFlow() {
  const router = useRouter();
  const hintId = useId();
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ScreenError | null>(null);
  const [announce, setAnnounce] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const initial = imageSize ? initialFrame(candidate?.bbox, imageSize) : null;
  const box = edited ?? returning ?? initial;

  function say(text: string) { setAnnounce((prev) => (prev === text ? `${text} ` : text)); }
  function commit(next: Box) { if (imageSize) say(sizeText(next, imageSize)); setError(null); }
  function reset() {
    if (!initial || !imageSize || busy) return;
    setEdited(initial);
    setError(null);
    say(`${a.resetDone} ${sizeText(initial, imageSize)}`);
  }

  async function use() {
    if (!box || busy) return;
    setError(null);
    // Cleared after navigating too: this route stays mounted, and Back must find Use this area enabled.
    await busyWhile(setBusy, true, false, async () => {
      try {
        await cutArea({
          api, getDraft,
          update: (patch) => { if (live.current) update(patch); },
          router: { push: (h) => { if (live.current) router.push(h); }, replace: (h) => { if (live.current) router.replace(h); } },
        }, box);
      } catch (err) {
        if (!live.current) return;
        setError(areaError(err));
        requestAnimationFrame(() => errorRef.current?.focus());
      }
    });
  }

  return (
    <AdjustAreaView
      hintId={hintId}
      back={adjustBack(draft)}
      retake={retake}
      none={!area.candidateId}
      busy={busy}
      photo={imageSize && originalUrl && box ? (
        <AreaFrame
          src={originalUrl} image={imageSize} box={box} disabled={busy}
          label={fmt(a.frameLabel, { size: sizeText(box, imageSize) })} describedBy={hintId}
          onChange={setEdited} onCommit={commit} onImageError={onImageError}
        />
      ) : null}
      photoState={detail.state === "loading" ? "loading" : "missing"}
      announce={announce}
      canUse={!!box}
      error={error}
      errorRef={errorRef}
      on={{ use: () => void use(), reset }}
    />
  );
}
