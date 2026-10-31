"use client";
import { useEffect, useRef } from "react";

/**
 * A muted, looped, inline decorative video that is only fetched and played when the viewer has not
 * asked for reduced motion (checked in the browser, and again if the setting changes). Until then
 * the element has no source, so nothing downloads; the caller shows a still image in its place.
 */
export function MotionVideo({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (mq.matches) {
        v.pause();
        if (v.getAttribute("src")) { v.removeAttribute("src"); v.load(); }
        return;
      }
      if (!v.getAttribute("src")) v.src = src;
      void v.play().catch(() => { /* autoplay refused: the first frame stays */ });
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [src]);
  return <video ref={ref} className={className} data-src={src} muted loop playsInline preload="none" aria-hidden="true" />;
}
