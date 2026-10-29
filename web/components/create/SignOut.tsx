import { cookies } from "next/headers";
import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { CREATOR_COOKIE } from "./constants";
import styles from "./Create.module.css";

/** Sign-out form (POST to the session route). Renders only when a creator is signed in. */
export async function SignOut() {
  if (!(await cookies()).get(CREATOR_COOKIE)?.value) return null;
  return (
    <form method="post" action="/create/code/session" className={styles.signout}>
      <input type="hidden" name="intent" value="signout" />
      <Button type="submit" variant="ghost" arrow={false}>{m.create.signOut}</Button>
    </form>
  );
}
