"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./Create.module.css";

/**
 * The bottom action bar (pinned; white). Its 1 px top border shows only while content scrolls under
 * it (tall boards); on short screens the bar sits at the end of the page without a line, as on the
 * short boards. A 1 px sentinel just above the bar tells which case applies. Without JavaScript the
 * bar simply has no line.
 */
export function PinnedBar({ children }: { children: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const s = sentinel.current;
    const b = bar.current;
    if (!s || !b || typeof IntersectionObserver === "undefined") return;
    let io: IntersectionObserver | null = null;
    const observe = () => {
      io?.disconnect();
      io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { rootMargin: `0px 0px -${Math.ceil(b.offsetHeight)}px 0px` });
      io.observe(s);
    };
    observe();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(observe);
    ro?.observe(b);
    return () => { io?.disconnect(); ro?.disconnect(); };
  }, []);
  return (
    <>
      <div ref={sentinel} className={styles.barSentinel} aria-hidden="true" />
      <div ref={bar} className={styles.footer} data-stuck={stuck ? "true" : undefined}><div className={styles.footerInner}>{children}</div></div>
    </>
  );
}
