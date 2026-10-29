import { encodeQr, qrPath } from "./encode";
import styles from "./QrCode.module.css";

/** Inline SVG QR code. `label` is announced to screen readers. */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { d, size } = qrPath(encodeQr(value));
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className={[styles.qr, className].filter(Boolean).join(" ")} shapeRendering="crispEdges">
      <rect width={size} height={size} className={styles.bg} />
      <path d={d} className={styles.fg} />
    </svg>
  );
}
