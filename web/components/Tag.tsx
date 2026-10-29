import { m } from "@/components/messages";
import styles from "./Tag.module.css";

export type TagPose = "listening" | "cheering" | "waving";

/**
 * Tag, the mascot: a lime story tag with a camera on its chest.
 * Pass `decorative` when nearby text already says what is happening.
 */
export function Tag({ pose = "waving", decorative = false, className }: { pose?: TagPose; decorative?: boolean; className?: string }) {
  const label = m.mascot[pose];
  return (
    <svg
      viewBox="0 0 140 150"
      className={[styles.tag, styles[pose], className].filter(Boolean).join(" ")}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
    >
      {/* legs */}
      <path className={styles.line} d="M57 134v10M83 134v10" />
      {/* arms (behind body) */}
      {pose === "waving" && (
        <>
          <path className={styles.line} d="M36 92 Q22 102 24 116" />
          <g className={styles.waveArm}>
            <path className={styles.line} d="M104 88 Q120 74 118 56" />
            <circle className={styles.hand} cx="118" cy="52" r="6" />
          </g>
        </>
      )}
      {pose === "cheering" && (
        <>
          <path className={styles.line} d="M36 88 Q20 72 22 52" />
          <circle className={styles.hand} cx="22" cy="48" r="6" />
          <path className={styles.line} d="M104 88 Q120 72 118 52" />
          <circle className={styles.hand} cx="118" cy="48" r="6" />
          <path className={styles.spark} d="M10 30l6 6M8 44h8M130 30l-6 6M132 44h-8M70 2v8" />
        </>
      )}
      {pose === "listening" && (
        <>
          <path className={styles.line} d="M36 92 Q22 102 24 116" />
          <path className={styles.line} d="M104 100 Q120 96 114 80" />
          <path className={styles.line} d="M114 80 L110 66" />
          <rect className={styles.mic} x="102" y="46" width="16" height="22" rx="8" />
          <path className={styles.micGrille} d="M106 54h8M106 60h8" />
          <path className={styles.spark} d="M126 40a12 12 0 0 1 0 18M131 34a20 20 0 0 1 0 30" />
        </>
      )}
      {/* body: luggage-tag shape */}
      <path className={styles.body} d="M70 12 L106 44 L106 124 Q106 134 96 134 L44 134 Q34 134 34 124 L34 44 Z" />
      <circle className={styles.hole} cx="70" cy="34" r="6" />
      {/* face */}
      <circle className={styles.ink} cx="58" cy="60" r="4.5" />
      <circle className={styles.ink} cx="82" cy="60" r="4.5" />
      {pose === "cheering"
        ? <path className={styles.mouthOpen} d="M58 70 Q70 86 82 70 Z" />
        : <path className={styles.line} d="M58 72 Q70 82 82 72" />}
      {/* camera on chest */}
      <rect className={styles.camera} x="52" y="94" width="36" height="25" rx="6" />
      <rect className={styles.ink} x="58" y="90" width="9" height="5" rx="2" />
      <circle className={styles.lens} cx="70" cy="106.5" r="7" />
      <circle className={styles.ink} cx="70" cy="106.5" r="2.5" />
    </svg>
  );
}
