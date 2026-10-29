"use client";
import { useEffect } from "react";
import { m } from "@/components/messages";
import { Tag } from "@/components/Tag";
import { Button } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { Stack } from "@/components/ui/Layout";
import { Lead } from "@/components/ui/Text";
import styles from "./ErrorState.module.css";

/** Friendly error boundary body with a retry button (used by segment error.tsx files). */
export function ErrorState({ error, retry, homeHref }: { error: unknown; retry: () => void; homeHref: string }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className={styles.wrap} role="alert">
      <Stack gap="xl">
        <Tag pose="waving" decorative className={styles.tag} />
        <Display as="h1" size="l">{m.errors.title}</Display>
        <Lead>{m.errors.copy}</Lead>
        <Button onClick={() => retry()}>{m.common.tryAgain}</Button>
        <Button href={homeHref} variant="ghost" arrow={false}>{m.errors.home}</Button>
      </Stack>
    </div>
  );
}
