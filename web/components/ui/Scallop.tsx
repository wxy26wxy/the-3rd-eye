import styles from "./Scallop.module.css";

const AMP = 16;
const PERIOD = 48.75;
const HEIGHT = 26;
const WIDTH = PERIOD * 8;

function wavePath() {
  let d = `M0 ${HEIGHT} L0 ${HEIGHT - AMP / 2}`;
  for (let x = 0; x < WIDTH; x += PERIOD) {
    d += ` Q${x + PERIOD / 2} ${HEIGHT - AMP / 2 - AMP} ${x + PERIOD} ${HEIGHT - AMP / 2}`;
  }
  return `${d} L${WIDTH} ${HEIGHT} Z`;
}
const D = wavePath();

/** Scalloped (wave) edge, placed directly above a cream bottom sheet. Decorative. */
export function Scallop({ className }: { className?: string }) {
  return (
    <svg className={[styles.scallop, className].filter(Boolean).join(" ")} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d={D} />
    </svg>
  );
}
