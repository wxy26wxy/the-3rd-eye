import { m } from "@/components/messages";
import styles from "./DieCut.module.css";

/**
 * Die-cut preview: the cleaned artwork with its cut line drawn on top. `cutPathSvg`
 * is SVG path data in the artwork's own coordinate space (`viewBox`).
 */
export function DieCut({ artworkUrl, cutPathSvg, alt, viewBox = "0 0 100 100" }: { artworkUrl: string | null; cutPathSvg: string | null; alt: string; viewBox?: string }) {
  if (!cutPathSvg || !artworkUrl) return null;
  return (
    <figure className={styles.figure}>
      <svg viewBox={viewBox} role="img" aria-label={alt} className={styles.svg}>
        <image href={artworkUrl} x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />
        <path d={cutPathSvg} className={styles.cut} />
      </svg>
      <figcaption className={styles.caption}><strong>{m.product.dieCutTitle}.</strong> {m.product.dieCutCaption}</figcaption>
    </figure>
  );
}
