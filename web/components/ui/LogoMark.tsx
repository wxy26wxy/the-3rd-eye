import { ASSETS } from "@/lib/assets";
import styles from "./LogoMark.module.css";

/** The eye mark, 40 × 35 (Sky, top-left of every screen). Decorative unless `label` is given. */
export function LogoMark({ label, className }: { label?: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={ASSETS.logoMark} alt={label ?? ""} className={[styles.mark, className].filter(Boolean).join(" ")} />
  );
}

