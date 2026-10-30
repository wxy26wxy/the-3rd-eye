import { m } from "@/components/messages";
import { readCodePrefill } from "@/lib/codes";
import { Button } from "@/components/ui/Button";
import { CreateScreen } from "../CreateScreen";
import { CodeField } from "./CodeField";
import styles from "../Create.module.css";

/**
 * Plain form POST to the session route handler: works without JavaScript. The studio's
 * sign-in link (`#c=CODE`, read in the browser) or its QR code (`?c=CODE`) only pre-fills the
 * field; the person still taps Sign in, so a screen reader announces the filled field before
 * anything happens. Without JavaScript the `#c=` link shows an empty field (type the code).
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
        <CodeField prefill={prefill} error={error} />
        <Button type="submit" block>{m.create.code.submit}</Button>
      </form>
    </CreateScreen>
  );
}
