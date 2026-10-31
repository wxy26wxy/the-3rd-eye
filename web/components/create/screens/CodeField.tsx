"use client";
import { useEffect, useId, useState } from "react";
import { m } from "@/components/messages";
import { Field } from "@/components/ui/Field";
import { readCodeFragment } from "@/lib/code-links";
import { ErrorCard } from "../cards";

/**
 * The creator-code field. `prefill` comes from the QR form (`?c=CODE`, read on the server);
 * the copied link carries the code in the fragment (`#c=CODE`), which only the browser sees,
 * so it is read here after load. Either way the code is then dropped from the address bar
 * (and so from this history entry). A prefill only: the person still taps Sign in.
 * A wrong code shows the error card under the field (board `2026:2930`), tied to the field.
 */
export function CodeField({ prefill, error }: { prefill: string; error: string | null }) {
  const [value, setValue] = useState(prefill);
  const errorId = useId();
  useEffect(() => {
    const fromHash = readCodeFragment(window.location.hash);
    // Filling the field from the fragment is a one-time sync with the URL, done after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fromHash) setValue(fromHash);
    const url = new URL(window.location.href);
    if (fromHash || url.searchParams.has("c")) {
      url.hash = "";
      url.searchParams.delete("c");
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
    }
  }, []);
  return (
    <>
      <Field key={value} label={m.create.code.label} name="code" required autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false}
        defaultValue={value || undefined} hint={value && !error ? m.create.code.prefilled : undefined} hintPosition="below"
        aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} />
      {error ? <ErrorCard id={errorId}>{error}</ErrorCard> : null}
    </>
  );
}
