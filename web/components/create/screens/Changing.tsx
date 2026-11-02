"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "@/components/messages";
import { speak } from "@/components/speech";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { api, type ChangeResult } from "../api";
import { ArtPreview } from "../art";
import { ErrorCard } from "../cards";
import { CreateScreen, HydratingScreen, MissingState } from "../CreateScreen";
import { describeError, type ScreenError } from "../errors";
import { addChange, currentArtworkId, currentChange, getDraft, once, useCreate, type ChangeStep } from "../store";

const d = m.create.drawing;

/**
 * Changing your art (boards `2027:3042` working, `2027:3062` error): `POST /artworks/{id}/change`
 * with the request from Change it (Muse Image edits the art on screen), then Before and after.
 * A loading screen: the logo mark, no Back. On failure: the error card, Try again / Back to my art.
 */
export function Changing() {
  const { ready, draft } = useCreate();
  const router = useRouter();
  const done = ready && !draft.changeInstruction && !!draft.changedArtworkId;
  useEffect(() => { if (done) router.replace("/create/compare"); }, [done, router]);
  if (!ready || done) return <HydratingScreen title={d.title} />;
  if (!draft.changeInstruction || !draft.pieceArtworkId) return <MissingState />;
  return <ChangingFlow />;
}

function ChangingFlow() {
  const router = useRouter();
  const { draft, update } = useCreate();
  const [error, setError] = useState<ScreenError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const base = currentArtworkId(draft) as string;
  const instruction = draft.changeInstruction as string;
  const transcript = draft.changeTranscript;
  const step = currentChange(draft);

  useEffect(() => {
    let live = true;
    once(`change:${base}:${instruction}:${attempt}`, () =>
      api<ChangeResult>(`artworks/${base}/change`, { json: transcript ? { instruction, transcript } : { instruction } }),
    )
      .then(({ artwork, description }) => {
        if (!live) return;
        const next: ChangeStep = {
          artworkId: artwork.id, parentId: base, instruction, transcript,
          previewUrl: artwork.previewUrl, alt: description.alt || artwork.altText, spoken: description.spoken || artwork.spokenDescription,
          differences: description.differences ?? "",
        };
        update({ ...addChange(getDraft(), next), changeInstruction: undefined, changeTranscript: undefined });
        if (next.spoken) speak(next.spoken);
        router.replace("/create/compare");
      })
      .catch((err) => { if (live) setError(describeError(err, d.error)); });
    return () => { live = false; };
  }, [base, instruction, transcript, attempt, router, update]);

  const art = <ArtPreview label={m.create.speak.artLabel} src={step ? step.previewUrl : draft.pieceUrl ?? null} alt={(step ? step.alt : draft.pieceAlt) ?? m.create.select.cutoutAlt} />;
  return (
    <CreateScreen
      title={d.title}
      footer={error ? (
        <>
          <Button block onClick={() => { setError(null); setAttempt((a) => a + 1); }}>{m.common.tryAgain}</Button>
          <Button block variant="secondary" arrow={false} href="/create/change" onClick={() => update({ changeInstruction: undefined, changeTranscript: undefined })}>{d.back}</Button>
        </>
      ) : null}
    >
      {art}
      {error ? <ErrorCard>{error.message}</ErrorCard> : <Loading label={d.copy} />}
    </CreateScreen>
  );
}
