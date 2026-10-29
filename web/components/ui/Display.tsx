import type { ReactNode } from "react";
import styles from "./Display.module.css";

type Props = {
  as?: "h1" | "h2" | "h3" | "p" | "span";
  size?: "xl" | "l" | "m";
  /** onGround: cream fill + ink stroke (on green). onCream: ink fill (on cream cards). */
  tone?: "onGround" | "onCream";
  tilt?: boolean;
  id?: string;
  children: ReactNode;
  className?: string;
};

/** Bagel Fat One display headline: uppercase, stroked, hard shadow, tilted −2°. */
export function Display({ as: Tag = "h2", size = "l", tone = "onGround", tilt = true, id, children, className }: Props) {
  return (
    <Tag id={id} className={[styles.display, styles[size], styles[tone], tilt ? styles.tilt : "", className].filter(Boolean).join(" ")}>
      {children}
    </Tag>
  );
}
