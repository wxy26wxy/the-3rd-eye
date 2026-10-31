import { m } from "@/components/messages";
import { readCodePrefill } from "@/lib/codes";
import { Button } from "@/components/ui/Button";
import { CreateScreen } from "../CreateScreen";
import { CodeField } from "./CodeField";
import styles from "../Create.module.css";

const FORM_ID = "creator-code-form";

/**
 * Sign in with code (boards `2026:2883`, prefilled `2026:2905`, error `2026:2930`). Plain form POST to
 * the session route handler: works without JavaScript (the Sign in button in the bottom bar submits
 * the form through its `form` attribute). The studio's sign-in link (`#c=CODE`, read in the browser)
 * or its QR code (`?c=CODE`) only pre-fills the field; the person still taps Sign in, so a screen
 * reader announces the filled field before anything happens. Without JavaScript the `#c=` link
 * shows an empty field (type the code).
 */
export async function CodeSignIn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/create/product";
  const error = sp.error ? m.create.code.error : null;
  const prefill = readCodePrefill(sp);
  return (
    <CreateScreen back="/create" title={m.create.code.title} lead={m.create.code.copy}
      footer={<Button type="submit" form={FORM_ID} block>{m.create.code.submit}</Button>}>
      <form id={FORM_ID} method="post" action="/create/code/session" className={styles.form}>
        <input type="hidden" name="next" value={next} />
        <CodeField prefill={prefill} error={error} />
      </form>
    </CreateScreen>
  );
}
