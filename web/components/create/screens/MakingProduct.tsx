"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { HydratingScreen, MissingState } from "../CreateScreen";
import { describeError, type ScreenError } from "../errors";
import { uuid, type Product } from "../api";
import { cutoutOf, getDraft, makeProduct, once, productToMake, refreshProduct, updateDraft, useCreate } from "../store";
import { MakingProductView } from "./MakingProductView";

/**
 * Making your sticker / tote bag (boards `4031:4378`, `4038:4628`): `POST /products` for the cut-out
 * from Your cutout, then Ready. The draft product for the same artwork and type is reused (browser
 * back + Use this, consistency item 6), its pictures read again when a later cut rebuilt them.
 */
export function MakingProduct() {
  const { ready, draft } = useCreate();
  const tote = draft.product === "tote";
  if (!ready) return <HydratingScreen title={tote ? m.create.making.titleTote : m.create.making.titleSticker} />;
  if (!draft.artworkId || !draft.product) return <MissingState />;
  return <MakingFlow key={draft.artworkId} artworkId={draft.artworkId} tote={tote} />;
}

/** The "Use this" attempt's `clientRequestId` (minted by `toMaking`; an older draft gets one here). */
function requestId(d: ReturnType<typeof getDraft>): string {
  if (d.productRequestId) return d.productRequestId;
  const id = uuid();
  updateDraft({ productRequestId: id });
  return id;
}

function MakingFlow({ artworkId, tote }: { artworkId: string; tote: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<ScreenError | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    const d = getDraft();
    const cut = cutoutOf(d, artworkId)?.cleanedUrl ?? null;
    const plan = productToMake(d);
    const work = plan === "reuse" ? Promise.resolve()
      : plan === "refresh" && d.productRecord ? once(`refresh:${d.productRecord.id}:${cut}`, () => refreshProduct(d.productRecord as Product, cut)).catch(() => {})
      : makeProduct(artworkId, tote ? "tote" : "sticker", attempt, cut, requestId(d));
    work
      .then(() => { if (live) router.replace("/create/ready"); })
      .catch((err) => { if (live) setError(describeError(err)); });
    return () => { live = false; };
  }, [artworkId, tote, attempt, router]);
  return (
    <MakingProductView
      tote={tote}
      status={fmt(m.create.result.making, { product: tote ? m.common.tote.toLowerCase() : m.common.sticker.toLowerCase() })}
      error={error}
      onRetry={() => { setError(null); setAttempt((a) => a + 1); }}
    />
  );
}
