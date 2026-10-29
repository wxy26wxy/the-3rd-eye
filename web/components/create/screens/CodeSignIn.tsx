import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CreateScreen } from "../CreateScreen";
import styles from "../Create.module.css";

/** Plain form POST to the session route handler: works without JavaScript. */
export async function CodeSignIn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/create/product";
  const error = sp.error ? m.create.code.error : null;
  return (
    <CreateScreen back="/create" title={m.create.code.title} lead={m.create.code.copy} mascot="waving">
      <form method="post" action="/create/code/session" className={styles.footerInner}>
        <input type="hidden" name="next" value={next} />
        <Field label={m.create.code.label} name="code" required autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} error={error} />
        <Button type="submit" block>{m.create.code.submit}</Button>
      </form>
    </CreateScreen>
  );
}
