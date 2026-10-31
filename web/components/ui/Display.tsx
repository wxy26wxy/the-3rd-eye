import type { ReactNode } from "react";
import styles from "./Display.module.css";

type Props = {
  as?: "h1" | "h2" | "h3" | "p" | "span";
  size?: "xl" | "l" | "m";
  /** onGround / onCream: ink text (kept for existing call sites; both look the same on Sky). onPhoto: white Bold on a photo. */
  tone?: "onGround" | "onCream" | "onPhoto";
  /** Deprecated: Sky has no tilt. Accepted and ignored so call sites keep compiling. */
  tilt?: boolean;
  id?: string;
  children: ReactNode;
  className?: string;
};

/** Inter display headline: 48 / 40 / 21 px, Medium, tracking −0.04em (Sky). */
export function Display({ as: Tag = "h2", size = "l", tone, id, children, className }: Props) {
  return (
    <Tag id={id} className={[styles.display, styles[size], tone === "onPhoto" ? styles.onPhoto : "", className].filter(Boolean).join(" ")}>
      {children}
    </Tag>
  );
}
