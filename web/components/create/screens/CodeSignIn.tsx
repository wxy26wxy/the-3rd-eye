import { m } from "@/components/messages";
import { readCodePrefill } from "@/lib/codes";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CreateScreen } from "../CreateScreen";
import styles from "../Create.module.css";

/**
 * Plain form POST to the session route handler: works without JavaScript. The studio's
 * sign-in link (`?c=CODE`) only pre-fills the field; the person still taps Sign in, so a
 * screen reader announces the filled field before anything happens.
 */
export async function CodeSignIn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/create/product";
  const error = sp.error ? m.create.code.error : null;
  const prefill = readCodePrefill(sp);
  return (
    <CreateScreen back="/create" title={m.create.code.title} lead={m.create.code.copy} mascot="waving">
      <form method="post" action="/create/code/session" className={styles.footerInner}>
        <input type="hidden" name="next" value={next} />
        <Field label={m.create.code.label} name="code" required autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} error={error}
          defaultValue={prefill || undefined} hint={prefill && !error ? m.create.code.prefilled : undefined} />
        <Button type="submit" block>{m.create.code.submit}</Button>
      </form>
    </CreateScreen>
  );
}
