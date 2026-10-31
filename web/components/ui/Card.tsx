import type { ComponentProps, ElementType, ReactNode } from "react";
import styles from "./Card.module.css";

type Props<T extends ElementType> = {
  as?: T;
  tone?: "cream" | "white" | "lime" | "ink";
  pad?: "s" | "m" | "l";
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<T>, "as" | "children" | "className">;

/** Sky card: white (`cream` and `white` are the same surface now), `lime` = accent green, `ink` = dark. 28 px radius, 1.5 px border. */
export function Card<T extends ElementType = "div">({ as, tone = "cream", pad = "m", children, className, ...rest }: Props<T>) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag className={[styles.card, styles[tone], styles[`pad-${pad}`], className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </Tag>
  );
}
