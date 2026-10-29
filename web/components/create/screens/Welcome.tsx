import { m } from "@/components/messages";
import { Suspense } from "react";
import { Button } from "@/components/ui/Button";
import { SignOut } from "../SignOut";
import { CreateScreen } from "../CreateScreen";
import styles from "../Create.module.css";

export function Welcome() {
  const promises = [m.create.welcome.promise1, m.create.welcome.promise2, m.create.welcome.promise3];
  return (
    <CreateScreen title={m.create.welcome.title} lead={m.create.welcome.copy} mascot="waving" footer={<><Button href="/create/product" block>{m.create.welcome.cta}</Button><Suspense fallback={null}><SignOut /></Suspense></>}>
      <ol role="list" className={styles.promises}>
        {promises.map((p, i) => (
          <li key={p} className={styles.promise}><span className={styles.promiseNum} aria-hidden="true">{i + 1}</span><span>{p}</span></li>
        ))}
      </ol>
    </CreateScreen>
  );
}
