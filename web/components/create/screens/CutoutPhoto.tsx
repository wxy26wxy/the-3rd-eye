"use client";
import { useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { fmt, m } from "@/components/messages";
import type { Candidate } from "../api";
import { fitRect, imageBox, imagePoint, percentRect, type Box, type CutoutPoint, type ImageSize, type Rect, type XY } from "../cutout";
import styles from "../Create.module.css";

export type TapMode = "add" | "remove" | "box";

/** Container-relative position of a pointer, plus where the photo sits in the container. */
function locate(el: HTMLElement, clientX: number, clientY: number, image: ImageSize): { p: XY; frame: Rect } {
  // The box has no border (the frame around it does), so its client rect is where the stage lives.
  const r = el.getBoundingClientRect();
  return { p: { x: clientX - r.left, y: clientY - r.top }, frame: fitRect(image, { width: r.width, height: r.height }) };
}

function pct(v: number) { return `${v}%`; }

/**
 * The photo with the pieces outlined (numbered, solid when chosen), the + / − marks and the box.
 * Taps add marks; in box mode a drag draws the box. Pointer only: the same actions are real
 * buttons under each piece (Select), so the tap layer is hidden from assistive tech. Marks are
 * buttons (44 px targets) that delete themselves.
 */
export function CutoutPhoto({ src, image, candidates, selectedIds, points, box, mode, disabled, onTap, onBox, onRemoveMark, onImageError }: {
  src: string; image: ImageSize; candidates: Candidate[]; selectedIds: string[]; points: CutoutPoint[]; box: Box | null;
  mode: TapMode; disabled: boolean; onTap: (p: XY) => void; onBox: (b: Box) => void; onRemoveMark: (index: number) => void;
  /** The presigned photo URL expired or failed: the screen fetches a fresh one. */
  onImageError?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ a: XY; b: XY } | null>(null);
  const boxRect = box ? percentRect(box, image) : null;

  function tap(e: MouseEvent<HTMLDivElement>) {
    if (disabled || mode === "box" || !ref.current) return;
    const { p, frame } = locate(ref.current, e.clientX, e.clientY, image);
    const ip = imagePoint(p, frame, image);
    if (ip) onTap(ip);
  }
  function down(e: PointerEvent<HTMLDivElement>) {
    if (disabled || mode !== "box" || !ref.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { p } = locate(ref.current, e.clientX, e.clientY, image);
    setDrag({ a: p, b: p });
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (!drag || !ref.current) return;
    const { p } = locate(ref.current, e.clientX, e.clientY, image);
    setDrag({ a: drag.a, b: p });
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    if (!drag || !ref.current) return;
    const { p, frame } = locate(ref.current, e.clientX, e.clientY, image);
    setDrag(null);
    const b = imageBox(drag.a, p, frame, image);
    if (b) onBox(b);
  }

  // The stage is the shown image (aspect ratio of the original); overlays are percentages of it.
  return (
    <div className={styles.cutFrame}>
      <div ref={ref} className={styles.cutPhoto} style={{ aspectRatio: `${image.w} / ${image.h}` }} role="group" aria-label={m.create.select.photoLabel}>
        <div className={styles.cutStage} style={{ aspectRatio: `${image.w} / ${image.h}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className={styles.cutImg} draggable={false} onError={onImageError} />
          {candidates.map((c, i) => {
            const r = percentRect(c.bbox, image);
            if (!r) return null;
            const on = selectedIds.includes(c.id);
            return (
              <span key={c.id} aria-hidden="true" className={[styles.outline, on ? styles.outlineOn : ""].join(" ")}
                style={{ left: pct(r.left), top: pct(r.top), width: pct(r.width), height: pct(r.height) }}>
                <span className={styles.chip}>{on ? "✓ " : ""}{i + 1}</span>
              </span>
            );
          })}
          {boxRect ? (
            <span aria-hidden="true" className={styles.drawnBox}
              style={{ left: pct(boxRect.left), top: pct(boxRect.top), width: pct(boxRect.width), height: pct(boxRect.height) }} />
          ) : null}
        </div>
        <div
          aria-hidden="true"
          className={[styles.tapLayer, mode === "box" ? styles.tapLayerBox : ""].join(" ")}
          onClick={tap}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => setDrag(null)}
        />
        {drag ? (
          <span aria-hidden="true" className={styles.drawnBox} style={{
            left: Math.min(drag.a.x, drag.b.x), top: Math.min(drag.a.y, drag.b.y),
            width: Math.abs(drag.b.x - drag.a.x), height: Math.abs(drag.b.y - drag.a.y),
          }} />
        ) : null}
        <div className={[styles.cutStage, styles.markLayer].join(" ")} style={{ aspectRatio: `${image.w} / ${image.h}` }}>
          {points.map((pt, i) => {
            const positive = pt.label === "positive";
            return (
              <button
                key={`${i}-${pt.x}-${pt.y}`}
                type="button"
                disabled={disabled}
                className={[styles.mark, positive ? styles.markAdd : styles.markRemove].join(" ")}
                style={{ left: pct((pt.x / image.w) * 100), top: pct((pt.y / image.h) * 100) }}
                aria-label={fmt(positive ? m.create.select.markAdded : m.create.select.markRemoved, { n: i + 1 })}
                onClick={() => onRemoveMark(i)}
              >
                <span className={styles.markDot} aria-hidden="true">{positive ? "+" : "−"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
