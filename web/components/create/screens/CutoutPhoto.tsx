"use client";
import { useRef, type MouseEvent } from "react";
import { fmt, m } from "@/components/messages";
import { fitRect, imagePoint, type CutoutPoint, type ImageSize, type XY } from "../cutout";
import styles from "../Create.module.css";

export type TapMode = "add" | "remove";

function pct(v: number) { return `${v}%`; }

/**
 * Your cutout's picture on "Fix the edges": the working picture (round 4: the crop of the frame, or
 * the changed picture; no frame outline, the picture is what was inside the frame) with the
 * numbered + / − marks.
 * A tap adds a mark (Add area or Remove area); a tap on a mark removes it. Pointer only: the tap
 * layer and the marks are hidden from assistive tech, and the same actions are real controls
 * under the picture ("Add the area around your art" and the Marks list).
 */
export function CutoutPhoto({ src, image, points, disabled, onTap, onRemoveMark, onImageError }: {
  src: string; image: ImageSize; points: CutoutPoint[]; disabled: boolean;
  onTap: (p: XY) => void; onRemoveMark: (index: number) => void;
  /** The presigned picture URL expired or failed: the screen fetches a fresh one. */
  onImageError?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function tap(e: MouseEvent<HTMLDivElement>) {
    if (disabled || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const ip = imagePoint({ x: e.clientX - r.left, y: e.clientY - r.top }, fitRect(image, { width: r.width, height: r.height }), image);
    if (ip) onTap(ip);
  }

  // The stage is the shown image (aspect ratio of the original); overlays are percentages of it.
  return (
    <div className={styles.cutFrame}>
      <div ref={ref} className={styles.cutPhoto} style={{ aspectRatio: `${image.w} / ${image.h}` }} role="group" aria-label={m.create.select.photoLabelCut}>
        <div className={styles.cutStage} style={{ aspectRatio: `${image.w} / ${image.h}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className={styles.cutImg} draggable={false} onError={onImageError} />
        </div>
        <div aria-hidden="true" className={styles.tapLayer} onClick={tap} />
        <div className={[styles.cutStage, styles.markLayer].join(" ")} style={{ aspectRatio: `${image.w} / ${image.h}` }}>
          {points.map((pt, i) => {
            const positive = pt.label === "positive";
            return (
              <button
                key={`${i}-${pt.x}-${pt.y}`}
                type="button"
                disabled={disabled}
                tabIndex={-1}
                aria-hidden="true"
                className={[styles.mark, positive ? styles.markAdd : styles.markRemove].join(" ")}
                style={{ left: pct((pt.x / image.w) * 100), top: pct((pt.y / image.h) * 100) }}
                aria-label={fmt(positive ? m.create.select.markAdded : m.create.select.markRemoved, { n: i + 1 })}
                onClick={() => onRemoveMark(i)}
              >
                <span className={styles.markDot} aria-hidden="true">{positive ? "+" : "−"}{i + 1}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
