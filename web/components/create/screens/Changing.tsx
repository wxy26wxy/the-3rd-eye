"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "@/components/messages";
import { speak } from "@/components/speech";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { api } from "../api";
import { ArtPreview } from "../art";
import { ErrorCard } from "../cards";
import { CreateScreen, HydratingScreen, MissingState } from "../CreateScreen";
import { describeError, type ScreenError } from "../errors";
import { artOnScreen, changeRequest, changingEntry, changingVisit, leaveChanging, runChange } from "../flow";
import { getDraft, once, useCreate } from "../store";

const d = m.create.drawing;

/**
 * Changing your art (boards `2027:3042` working, `2027:3062` error): `POST /artworks/{id}/change`
 * with the request from Change it (Muse Image edits the art on screen), then Before and after.
 * A loading screen: the logo mark, no Back. On failure: the error card, Try again / Back to my art.
 */
export function Changing() {
  const { ready, draft } = useCreate();
  if (!ready) return <HydratingScreen title={d.title} />;
  // A new "Make the change" remounts with fresh state; "Back to my art" keeps the key (it only drops the request).
  return <ChangingGate key={draft.changeNonce ?? "none"} />;
}

/**
 * Decided once on arrival (a later draft change, such as "Back to my art" clearing the request,
 * must not send the creator to Before and after or flash the start-over screen).
 */
function ChangingGate() {
  const router = useRouter();
  const [entry] = useState(() => changingEntry(getDraft()));
  const [req] = useState(() => changeRequest(getDraft()));
  useEffect(() => { if (entry === "compare") router.replace("/create/compare"); }, [entry, router]);
  if (entry === "compare") return <HydratingScreen title={d.title} />;
  if (entry === "missing" || !req) return <MissingState />;
  return <ChangingFlow req={req} nonce={getDraft().changeNonce} />;
}

function ChangingFlow({ req, nonce }: { req: { base: string; instruction: string; transcript?: string }; nonce: string | undefined }) {
  const router = useRouter();
  const { draft, update } = useCreate();
  const [error, setError] = useState<ScreenError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [art] = useState(() => artOnScreen(draft));
  // While the creator is on this screen (a ref, so a Strict Mode remount keeps the shared request's result).
  const here = useRef(true);
  useEffect(() => { here.current = true; return () => { here.current = false; }; }, []);

  useEffect(() => {
    // Runs again when the kept-mounted route is shown again: a finished request is never re-sent.
    const visit = changingVisit(getDraft(), nonce);
    if (visit !== "send") {
      if (visit === "compare") router.replace("/create/compare");
      return;
    }
    const deps = {
      api, getDraft,
      update: (patch: Parameters<typeof update>[0]) => { if (here.current) update(patch); },
      router: { push: (h: string) => { if (here.current) router.push(h); }, replace: (h: string) => { if (here.current) router.replace(h); } },
    };
    once(`change:${nonce}:${attempt}`, () => runChange(deps, req))
      .then((step) => { if (here.current && step.spoken) speak(step.spoken); })
      .catch((err) => { if (here.current) setError(describeError(err, d.error)); });
  }, [req, nonce, attempt, router, update]);

  return (
    <CreateScreen
      title={d.title}
      footer={error ? (
        <>
          <Button block onClick={() => { setError(null); setAttempt((a) => a + 1); }}>{m.common.tryAgain}</Button>
          <Button block variant="secondary" arrow={false} onClick={() => leaveChanging({ router, update })}>{d.back}</Button>
        </>
      ) : null}
    >
      <ArtPreview label={m.create.speak.artLabel} src={art.src} alt={art.alt ?? m.create.select.cutoutAlt} />
      {error ? <ErrorCard>{error.message}</ErrorCard> : <Loading label={d.copy} />}
    </CreateScreen>
  );
}
