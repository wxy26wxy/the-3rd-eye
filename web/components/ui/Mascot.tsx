import { m } from "@/components/messages";
import { ASSETS } from "@/lib/assets";
import styles from "./Mascot.module.css";

export type MascotPose = "book" | "front" | "magnifier";

const SRC: Record<MascotPose, string> = {
  book: ASSETS.mascotBook,
  front: ASSETS.mascotFront,
  magnifier: ASSETS.mascotMagnifier,
};

/**
 * The mascot (Sky): photographic fuzzy green monster from /assets. `magnifier` is an animated GIF;
 * under prefers-reduced-motion the still front pose is shown instead.
 * Pass `decorative` when nearby text already says what is happening (alt="").
 */
export function Mascot({ pose = "front", decorative = false, eager, className }: { pose?: MascotPose; decorative?: boolean; eager?: boolean; className?: string }) {
  const alt = decorative ? "" : m.mascot[pose];
  const cls = [styles.mascot, styles[pose], className].filter(Boolean).join(" ");
  const loading = eager ? "eager" : "lazy";
  if (pose === "magnifier") {
    return (
      <picture className={cls}>
        <source media="(prefers-reduced-motion: reduce)" srcSet={ASSETS.mascotFront} />
        <img src={SRC.magnifier} alt={alt} loading={loading} decoding="async" />
      </picture>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={SRC[pose]} alt={alt} loading={loading} decoding="async" className={cls} />
  );
}
