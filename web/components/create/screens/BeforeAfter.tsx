"use client";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { useReadAloud } from "../art";
import { HydratingScreen, MissingState } from "../CreateScreen";
import { fixCutout, productPicture, takeChange } from "../flow";
import { backToOriginal, currentChange, cutoutOf, getDraft, useCreate } from "../store";
import { BeforeAfterView } from "./BeforeAfterView";

/**
 * Before and after (R2; round 4 ruling 2): the two product photos, before = the sticker / tote bag
 * of the art the change was made from (the piece, or the previous change), after = the one of the
 * change result (made on Changing). "Use this" and "Change it again" open Change it on the change
 * result (its product is made, so its photo shows at once); "Back to my original" switches the draft
 * to the parent (no API call; the child stays an unused draft); "Fix the cutout" opens Your cutout
 * of the change result.
 */
export function BeforeAfter() {
  const router = useRouter();
  const { ready, draft, update } = useCreate();
  const { playing, toggle } = useReadAloud();
  if (!ready) return <HydratingScreen title={m.create.result.title} />;
  const step = currentChange(draft);
  if (!step || !draft.product) return <MissingState />;
  const tote = draft.product === "tote";
  const alt = (what: string | null) => fmt(m.create.result.productAlt, { product: tote ? m.common.tote.toLowerCase() : m.common.sticker.toLowerCase() }) + (what ? `: ${what}` : "");
  const parent = draft.changes?.find((c) => c.artworkId === step.parentId);
  const shows = step.spoken ?? step.alt;
  return (
    <BeforeAfterView
      subtitle={tote ? m.create.result.subtitleTote : m.create.result.subtitleSticker}
      asked={step.instruction}
      before={{ src: productPicture(draft, step.parentId).src, alt: alt(parent ? parent.alt : draft.pieceAlt ?? null) }}
      after={{ src: productPicture(draft, step.artworkId).src, alt: alt(step.alt) }}
      shows={shows}
      differences={step.differences}
      playing={playing}
      canFix={!!cutoutOf(draft, step.artworkId)}
      on={{
        hear: () => toggle(shows),
        use: () => takeChange({ router, update }, step.artworkId),
        again: () => takeChange({ router, update }, step.artworkId),
        original: () => { update(backToOriginal(draft)); router.push("/create/change"); },
        fix: () => fixCutout({ router, update, getDraft }, "/create/compare"),
      }}
    />
  );
}
