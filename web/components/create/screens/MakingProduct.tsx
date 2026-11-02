"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { HydratingScreen, MissingState } from "../CreateScreen";
import { describeError, type ScreenError } from "../errors";
import { makeProduct, useCreate } from "../store";
import { MakingProductView } from "./MakingProductView";

/**
 * Making your sticker / tote bag (boards `4031:4378`, `4038:4628`): `POST /products` for the cut-out
 * from Your cutout, then Ready.
 */
export function MakingProduct() {
  const { ready, draft } = useCreate();
  const tote = draft.product === "tote";
  if (!ready) return <HydratingScreen title={tote ? m.create.making.titleTote : m.create.making.titleSticker} />;
  if (!draft.artworkId || !draft.product) return <MissingState />;
  // Already made (Back from Ready): no second product.
  const made = draft.productRecord?.artworkId === draft.artworkId && draft.productRecord?.type === draft.product;
  return <MakingFlow artworkId={draft.artworkId} tote={tote} made={made} />;
}

function MakingFlow({ artworkId, tote, made }: { artworkId: string; tote: boolean; made: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<ScreenError | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    if (made) { router.replace("/create/ready"); return; }
    makeProduct(artworkId, tote ? "tote" : "sticker", attempt)
      .then(() => { if (live) router.replace("/create/ready"); })
      .catch((err) => { if (live) setError(describeError(err)); });
    return () => { live = false; };
  }, [artworkId, tote, made, attempt, router]);
  return (
    <MakingProductView
      tote={tote}
      status={fmt(m.create.result.making, { product: tote ? m.common.tote.toLowerCase() : m.common.sticker.toLowerCase() })}
      error={error}
      onRetry={() => { setError(null); setAttempt((a) => a + 1); }}
    />
  );
}
