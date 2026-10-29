import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { omit } from "./omit";
import styles from "./IconButton.module.css";

type Common = { label: string; children: ReactNode; className?: string };
type Props =
  | (Common & { href: string } & Omit<ComponentProps<typeof Link>, "href" | "children" | "className">)
  | (Common & { href?: undefined } & Omit<ComponentProps<"button">, "children" | "className">);

/** 48 px round icon button on cream. `label` is the accessible name. */
export function IconButton(props: Props) {
  const { label, children, className } = props;
  const c = [styles.icon, className].filter(Boolean).join(" ");
  const inner = <span aria-hidden="true">{children}</span>;
  if (props.href !== undefined) {
    const { href, ...linkProps } = omit(props, ["label", "children", "className"]);
    return <Link href={href} aria-label={label} title={label} className={c} {...linkProps}>{inner}</Link>;
  }
  const { type = "button", ...buttonProps } = omit(props, ["label", "children", "className", "href"]);
  return <button type={type} aria-label={label} title={label} className={c} {...buttonProps}>{inner}</button>;
}
