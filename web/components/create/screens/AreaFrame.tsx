"use client";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { m } from "@/components/messages";
import { AREA_CORNERS, AREA_EDGES, dragFrame, framePercent, keyFrame, sameBox, type AreaHandle } from "../area";
import type { Box, ImageSize } from "../cutout";
import styles from "../Create.module.css";

const pct = (v: number) => `${v}%`;

/**
 * The photo with the resizable frame (Adjust the area, R2). The photo outside the frame is dimmed.
 * Pointer: drag a corner (two sides) or an edge (one side) to resize, or inside the frame to move it;
 * every handle is a 44 px target centred on the frame's line. Keyboard: the frame is one focusable
 * element; arrows move it, Shift + arrows resize it. The handles are decoration for assistive tech;
 * the screen announces the frame's size in its live region (`describedBy`).
 */
export function AreaFrame({ src, image, box, disabled, label, describedBy, onChange, onCommit, onLimit, onImageError }: {
  src: string; image: ImageSize; box: Box; disabled: boolean; label: string; describedBy?: string;
  /** Every change while dragging or on a key press. */
  onChange: (box: Box) => void;
  /** The end of a drag or a key press: the screen announces the frame's size. */
  onCommit: (box: Box) => void;
  /** A key press that changed nothing: the frame is at the photo's edge, or already at its smallest. */
  onLimit?: (kind: "edge" | "small") => void;
  onImageError?: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: AreaHandle; x: number; y: number; start: Box; last: Box; w: number; h: number } | null>(null);
  const r = framePercent(box, image);
  const rect = { left: pct(r.left), top: pct(r.top), width: pct(r.width), height: pct(r.height) };

  function down(e: PointerEvent<HTMLDivElement>) {
    if (disabled || !stage.current || drag.current) return;
    const handle = (e.target as HTMLElement).closest<HTMLElement>("[data-handle]")?.dataset.handle as AreaHandle | undefined;
    if (!handle) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const s = stage.current.getBoundingClientRect();
    drag.current = { handle, x: e.clientX, y: e.clientY, start: box, last: box, w: s.width, h: s.height };
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.w <= 0 || d.h <= 0) return;
    const next = dragFrame(d.start, d.handle, ((e.clientX - d.x) * image.w) / d.w, ((e.clientY - d.y) * image.h) / d.h, image);
    d.last = next;
    onChange(next);
  }
  function up() {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    onCommit(d.last);
  }
  function key(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const next = keyFrame(box, e.key, e.shiftKey, image);
    if (!next) return;
    e.preventDefault();
    if (sameBox(next, box)) { onLimit?.(e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowUp") ? "small" : "edge"); return; }
    onChange(next);
    onCommit(next);
  }

  return (
    <div className={[styles.cutFrame, styles.areaFrame].join(" ")}>
      <div className={styles.cutPhoto} style={{ aspectRatio: `${image.w} / ${image.h}` }}>
        <div
          ref={stage}
          className={styles.cutStage}
          style={{ aspectRatio: `${image.w} / ${image.h}` }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={m.create.adjust.photoLabel} className={styles.cutImg} draggable={false} onError={onImageError} />
          <div className={styles.areaShade} aria-hidden="true"><span style={rect} /></div>
          <div
            role="group"
            tabIndex={disabled ? -1 : 0}
            aria-label={label}
            aria-roledescription={m.create.adjust.frameRole}
            aria-describedby={describedBy}
            aria-disabled={disabled || undefined}
            className={styles.area}
            data-handle="move"
            style={rect}
            onKeyDown={key}
          >
            {AREA_EDGES.map((h) => <span key={h} aria-hidden="true" data-handle={h} className={styles.areaEdge} data-side={h} />)}
            {AREA_CORNERS.map((h) => (
              <span key={h} aria-hidden="true" data-handle={h} className={styles.areaCorner} data-corner={h}><span className={styles.areaKnob} /></span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
