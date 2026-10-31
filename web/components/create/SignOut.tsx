import { cookies } from "next/headers";
import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { CREATOR_COOKIE } from "./constants";
import styles from "./Create.module.css";

/**
 * The Welcome footer's text action (the only place Sign out appears on the web creator flow):
 * signed in → Sign out (form POST to the session route); signed out → "I already have an account",
 * a link to the code screen.
 */
export async function WelcomeAccount() {
  const signedIn = !!(await cookies()).get(CREATOR_COOKIE)?.value;
  return (
    <div className={styles.welcomeLinks}>
      {signedIn ? (
        <form method="post" action="/create/code/session">
          <input type="hidden" name="intent" value="signout" />
          <Button type="submit" variant="ghost" arrow={false}>{m.create.signOut}</Button>
        </form>
      ) : (
        <Button href="/create/code" variant="ghost" arrow={false}>{m.create.welcome.haveAccount}</Button>
      )}
    </div>
  );
}
