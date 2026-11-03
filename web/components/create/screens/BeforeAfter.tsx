"use client";
import { useRouter } from "next/navigation";
import { m } from "@/components/messages";
import { useReadAloud } from "../art";
import { HydratingScreen, MissingState } from "../CreateScreen";
import { takeChange } from "../flow";
import { backToOriginal, currentChange, useCreate } from "../store";
import { BeforeAfterView } from "./BeforeAfterView";

/**
 * Before and after (R2): before = the art the change was made from (the picked piece's cut-out, or the
 * previous change's picture), after = the edited picture. "Back to my original" switches the draft to
 * that parent (no API call; the child stays an unused draft), "Change it again" edits the child,
 * "Use this" cuts the child out on the next screen (once per artwork) and shows it on Your cutout.
 */
export function BeforeAfter() {
  const router = useRouter();
  const { ready, draft, update } = useCreate();
  const { playing, toggle } = useReadAloud();
  if (!ready) return <HydratingScreen title={m.create.result.title} />;
  const step = currentChange(draft);
  if (!step || !draft.product) return <MissingState />;
  const parent = draft.changes?.find((c) => c.artworkId === step.parentId);
  const fallbackAlt = m.create.select.cutoutAlt;
  const shows = step.spoken ?? step.alt;
  return (
    <BeforeAfterView
      asked={step.instruction}
      before={parent ? { src: parent.previewUrl, alt: parent.alt ?? fallbackAlt } : { src: draft.pieceUrl ?? null, alt: draft.pieceAlt ?? fallbackAlt }}
      after={{ src: step.previewUrl, alt: step.alt ?? fallbackAlt }}
      shows={shows}
      differences={step.differences}
      playing={playing}
      on={{
        hear: () => toggle(shows),
        use: () => takeChange({ router, update }, step.artworkId),
        again: () => router.push("/create/change"),
        original: () => { update(backToOriginal(draft)); router.push("/create/change"); },
      }}
    />
  );
}
