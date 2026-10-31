import { m } from "@/components/messages";
import styles from "./DieCut.module.css";

/**
 * Die-cut preview card (board 2019:2031): title, the cleaned artwork with its dashed cut line on a grey
 * well, caption. `cutPathSvg` is SVG path data in the artwork's own coordinate space (`viewBox`); a cut
 * of several pieces has one `M…Z` subpath per piece, all drawn by the one path. The border runs a few
 * units past the artwork box, so the svg does not clip (overflow visible, inside the well's padding).
 */
export function DieCut({ artworkUrl, cutPathSvg, alt, viewBox = "0 0 100 100" }: { artworkUrl: string | null; cutPathSvg: string | null; alt: string; viewBox?: string }) {
  if (!cutPathSvg || !artworkUrl) return null;
  return (
    <figure className={styles.figure}>
      <p className={styles.title} aria-hidden="true">{m.product.dieCutTitle}</p>
      <div className={styles.well}>
        <svg viewBox={viewBox} role="img" aria-label={alt} className={styles.svg}>
          <image href={artworkUrl} x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />
          <path d={cutPathSvg} className={styles.cut} />
        </svg>
      </div>
      <figcaption className={styles.caption}><span className="visually-hidden">{m.product.dieCutTitle}. </span>{m.product.dieCutCaption}</figcaption>
    </figure>
  );
}
