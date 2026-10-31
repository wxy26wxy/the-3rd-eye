import { m } from "@/components/messages";
import { ASSETS } from "@/lib/assets";
import styles from "./Mascot.module.css";

export type MascotPose = "book" | "front" | "magnifier";

const SRC: Record<Exclude<MascotPose, "magnifier">, string> = {
  book: ASSETS.mascotBook,
  front: ASSETS.mascotFront,
};

/**
 * The mascot (Sky): photographic fuzzy green monster from /assets. `magnifier` is the searching
 * animation, played from its MP4 (muted, looped, inline; the 5.7 MB GIF is never loaded on a page).
 * Under prefers-reduced-motion the video is hidden and the still front pose shows instead (CSS only).
 * Pass `decorative` when nearby text already says what is happening (alt="").
 */
export function Mascot({ pose = "front", decorative = false, eager, className }: { pose?: MascotPose; decorative?: boolean; eager?: boolean; className?: string }) {
  const alt = decorative ? "" : m.mascot[pose];
  const cls = [styles.mascot, styles[pose], className].filter(Boolean).join(" ");
  const loading = eager ? "eager" : "lazy";
  if (pose === "magnifier") {
    return (
      <span className={cls} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
        <video className={styles.motion} src={ASSETS.mascotMagnifierVideo} autoPlay muted loop playsInline preload="auto" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.still} src={ASSETS.mascotFront} alt="" loading={loading} decoding="async" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={SRC[pose]} alt={alt} loading={loading} decoding="async" className={cls} />
  );
}
