"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Loading, Status } from "@/components/ui/Loading";
import { api, type ArtworkVariant } from "../api";
import { CreateScreen, MissingState } from "../CreateScreen";
import { describeError, type ScreenError } from "../errors";
import { once, useCreate } from "../store";

/** Generates variants for the shaped prompt, then moves on to the result screen. */
export function Drawing() {
  const router = useRouter();
  const { ready, draft, update } = useCreate();
  const [error, setError] = useState<ScreenError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const shaped = draft.shaped;
  const hasVariants = !!draft.variants?.length;

  useEffect(() => {
    if (!ready || !shaped || !draft.product) return;
    if (hasVariants) { router.replace("/create/result"); return; }
    let live = true;
    once(`generate:${shaped.prompt}:${attempt}`, () =>
      api<{ artworks: ArtworkVariant[] }>("artworks", { json: { source: "text2image", prompt: shaped.prompt, transcript: draft.transcript, product: draft.product, n: 4 } }),
    )
      .then(({ artworks }) => {
        update({ variants: artworks, artworkId: artworks[0]?.id });
        if (live) router.replace("/create/result");
      })
      .catch((err) => { if (live) setError(describeError(err, m.create.drawing.error)); });
    return () => { live = false; };
  }, [ready, shaped, hasVariants, draft.product, draft.transcript, attempt, router, update]);

  if (ready && !shaped) return <MissingState />;
  return (
    <CreateScreen title={m.create.drawing.title} lead={error ? undefined : m.create.drawing.copy} mascot="cheering">
      {error ? (
        <>
          <Status tone="error">{error.message}</Status>
          <Button block onClick={() => { setError(null); setAttempt((a) => a + 1); }}>{m.common.tryAgain}</Button>
          <Button block variant="secondary" arrow={false} href="/create/speak">{m.create.speak.redo}</Button>
        </>
      ) : <Loading label={m.create.drawing.title} />}
    </CreateScreen>
  );
}
