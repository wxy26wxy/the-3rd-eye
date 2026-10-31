import { ASSETS } from "@/lib/assets";
import styles from "./LogoMark.module.css";

/** The eye mark, 40 × 35 (Sky, top-left of every screen). Decorative unless `label` is given. `tone="white"` on photos. */
export function LogoMark({ label, tone = "ink", className }: { label?: string; tone?: "ink" | "white"; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={ASSETS.logoMark} alt={label ?? ""} className={[styles.mark, tone === "white" ? styles.white : "", className].filter(Boolean).join(" ")} />
  );
}
