"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "@/components/messages";
import { api, type CutoutResult } from "../api";
import { HydratingScreen, MissingState } from "../CreateScreen";
import { usableSize } from "../cutout";
import { describeError, type ScreenError } from "../errors";
import { currentChange, once, resetDraft, useCreate, type CutoutState } from "../store";
import { MakingCutoutView } from "./MakingCutoutView";
import { YourCutoutView } from "./YourCutoutView";

const t = m.create.select;
const c = m.create.cutout;

/**
 * /create/cutout. For a change result without a cut-out yet: Making your cutout
 * (`POST /artworks/{id}/cutout`, SAM auto-picks the largest piece). Then Your cutout (R3): the
 * cut-out, Use this and Start over; the area is set on Adjust the area, never here.
 */
export function Cutout() {
  const { ready, draft } = useCreate();
  if (!ready) return <HydratingScreen title={c.title} />;
  const target = draft.cutoutArtworkId;
  if (!target || !draft.product) return <MissingState />;
  if (draft.cutout?.artworkId === target) return <YourCutoutFlow key={target} cutout={draft.cutout} />;
  return <MakingCutout key={target} artworkId={target} />;
}

function MakingCutout({ artworkId }: { artworkId: string }) {
  const { draft, update } = useCreate();
  const [error, setError] = useState<ScreenError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const step = draft.changes?.find((s) => s.artworkId === artworkId) ?? null;
  useEffect(() => {
    let live = true;
    once(`cutout:${artworkId}:${attempt}`, () => api<CutoutResult>(`artworks/${artworkId}/cutout`, { method: "POST", json: {} }))
      .then((res) => {
        if (!live) return;
        const first = res.candidates[0]?.id;
        update({
          cutout: { artworkId, candidates: res.candidates, imageSize: res.imageSize, selectedIds: first ? [first] : [], cleanedUrl: res.artwork.cleanedUrl, altText: res.artwork.altText },
          cutoutNotice: undefined,
        });
      })
      .catch((err) => {
        // Nothing found on the changed picture shows the API's reason; Back returns to the art.
        if (live) setError(describeError(err));
      });
    return () => { live = false; };
  }, [artworkId, attempt, update]);
  return (
    <MakingCutoutView
      changed={!!step}
      error={error}
      back={step ? "/create/compare" : "/create/change"}
      onRetry={() => { setError(null); setAttempt((a) => a + 1); }}
    />
  );
}

function YourCutoutFlow({ cutout }: { cutout: CutoutState }) {
  const router = useRouter();
  const { draft, update } = useCreate();
  const changed = !!currentChange(draft) || cutout.artworkId !== draft.pieceArtworkId;
  const size = usableSize(cutout.imageSize) ? cutout.imageSize : null;

  /** "Use this": the cut on screen goes on to Making your sticker / tote bag (no call here). */
  function goOn() {
    if (!cutout.cleanedUrl) return;
    update({ artworkId: cutout.artworkId, productRecord: undefined });
    router.push("/create/making");
  }
  function startOver() {
    resetDraft({ product: draft.product });
    router.push("/create/method");
  }

  return (
    <YourCutoutView
      title={c.title}
      lead={changed ? c.copy : c.copyOriginal}
      back={changed ? "/create/compare" : "/create/change"}
      cut={cutout.cleanedUrl ? { src: cutout.cleanedUrl, alt: cutout.altText ?? t.cutoutAlt, aspectRatio: size ? `${size.w} / ${size.h}` : undefined } : null}
      notice={draft.cutoutNotice ?? null}
      on={{ use: goOn, startOver }}
    />
  );
}
