import type { ReactNode } from "react";
import styles from "./Layout.module.css";

export function Container({ children, width = "max", className }: { children: ReactNode; width?: "max" | "narrow"; className?: string }) {
  return <div className={[styles.container, width === "narrow" ? styles.narrow : "", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function Section({ children, labelledBy, className, id }: { children: ReactNode; labelledBy?: string; className?: string; id?: string }) {
  return <section id={id} aria-labelledby={labelledBy} className={[styles.section, className].filter(Boolean).join(" ")}>{children}</section>;
}

export function Stack({ children, gap = "l", className, as: Tag = "div" }: { children: ReactNode; gap?: "xs" | "s" | "m" | "l" | "xl" | "xxl" | "section"; className?: string; as?: "div" | "ul" | "ol" | "form" }) {
  return <Tag className={[styles.stack, styles[`gap-${gap}`], className].filter(Boolean).join(" ")} role={Tag === "ul" || Tag === "ol" ? "list" : undefined}>{children}</Tag>;
}

export function Row({ children, gap = "m", wrap = true, align = "center", justify = "start", className }: { children: ReactNode; gap?: "xs" | "s" | "m" | "l" | "xl"; wrap?: boolean; align?: "center" | "start" | "end"; justify?: "start" | "between" | "center" | "end"; className?: string }) {
  return <div className={[styles.row, styles[`gap-${gap}`], wrap ? styles.wrap : "", styles[`align-${align}`], styles[`justify-${justify}`], className].filter(Boolean).join(" ")}>{children}</div>;
}

/** Responsive grid of cards: 1 column on phones, up to `cols` on wide screens. */
export function Grid({ children, cols = 3, className, as: Tag = "ul" }: { children: ReactNode; cols?: 2 | 3 | 4; className?: string; as?: "ul" | "div" }) {
  return <Tag role={Tag === "ul" ? "list" : undefined} className={[styles.grid, styles[`cols-${cols}`], className].filter(Boolean).join(" ")}>{children}</Tag>;
}
