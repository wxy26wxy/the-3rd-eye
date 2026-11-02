"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Display } from "@/components/ui/Display";
import styles from "./Create.module.css";

/**
 * The screen's h1. Every /create page has the same document title, so the route announcer has
 * nothing new to say: on mount the heading takes focus (tabIndex -1), which reads the new screen
 * and puts the next Tab on its first control. A phase change inside a screen keeps the heading
 * mounted and leaves focus to the screen.
 */
export function ScreenTitle({ children, badge }: { children: string; badge?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h1 = ref.current?.querySelector("h1");
    if (!h1) return;
    h1.tabIndex = -1;
    // A control that already has focus (e.g. a screen that focused its own field) keeps it.
    if (document.activeElement === document.body || document.activeElement === null) h1.focus({ preventScroll: true });
  }, []);
  return (
    <div ref={ref} className={styles.titleRow}>
      <Display as="h1" size="xl">{children}</Display>
      {badge}
    </div>
  );
}
