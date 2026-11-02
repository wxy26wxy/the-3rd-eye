import { cookies } from "next/headers";
import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { CREATOR_COOKIE } from "./constants";
import styles from "./Create.module.css";

/**
 * The Welcome text action (ink, board `2026:2865`; the only place Sign out appears on the web
 * creator flow): signed in → Sign out (form POST to the session route, works without JavaScript);
 * signed out → "I already have an account", a link to the code screen (as on the board).
 */
export function WelcomeAccountView({ signedIn }: { signedIn: boolean }) {
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

/** Reads the creator cookie (dynamic), so Welcome renders it inside Suspense. */
export async function WelcomeAccount() {
  const signedIn = !!(await cookies()).get(CREATOR_COOKIE)?.value;
  return <WelcomeAccountView signedIn={signedIn} />;
}
