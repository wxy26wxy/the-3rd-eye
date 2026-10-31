import { Suspense } from "react";
import { m } from "@/components/messages";
import { ASSETS } from "@/lib/assets";
import { Button } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { LogoMark } from "@/components/ui/LogoMark";
import { WelcomeAccount } from "../SignOut";
import styles from "../Create.module.css";

/**
 * Welcome (board `2026:2865`): full-bleed sky photo; white text on dark scrim panels (headline and
 * copy at the top, the three numbered promises at the bottom); the white "Start creating" pill; and
 * one text action (Sign out when signed in, else "I already have an account").
 */
export function Welcome() {
  const promises = [m.create.welcome.promise1, m.create.welcome.promise2, m.create.welcome.promise3];
  return (
    <div className={styles.welcome}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ASSETS.welcomeBg} alt="" className={styles.welcomeBg} fetchPriority="high" />
      <div className={styles.welcomeTop}>
        <LogoMark tone="white" />
        <div className={styles.scrim}>
          <Display as="h1" size="xl" tone="onPhoto">{m.create.welcome.title}</Display>
          <p>{m.create.welcome.copy}</p>
        </div>
      </div>
      <div className={styles.welcomeBottom}>
        <ol className={[styles.scrim, styles.promises].join(" ")}>
          {promises.map((p) => <li key={p}>{p}</li>)}
        </ol>
        <Button href="/create/product" variant="white" block>{m.create.welcome.cta}</Button>
        <Suspense fallback={null}><WelcomeAccount /></Suspense>
      </div>
    </div>
  );
}
