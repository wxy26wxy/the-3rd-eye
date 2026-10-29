import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import styles from "./IconButton.module.css";

type Common = { label: string; children: ReactNode; className?: string };
type Props =
  | (Common & { href: string } & Omit<ComponentProps<typeof Link>, "href" | "children" | "className">)
  | (Common & { href?: undefined } & Omit<ComponentProps<"button">, "children" | "className">);

/** 48 px round icon button on cream. `label` is the accessible name. */
export function IconButton(props: Props) {
  const { label, children, className } = props;
  const c = [styles.icon, className].filter(Boolean).join(" ");
  const { label: _label, children: _children, className: _className, ...rest } = props;
  const inner = <span aria-hidden="true">{children}</span>;
  if (rest.href !== undefined) {
    const { href, ...linkProps } = rest as Omit<Extract<Props, { href: string }>, keyof Common>;
    return <Link href={href} aria-label={label} title={label} className={c} {...linkProps}>{inner}</Link>;
  }
  const { type = "button", ...buttonProps } = rest as Omit<Extract<Props, { href?: undefined }>, keyof Common>;
  return <button type={type} aria-label={label} title={label} className={c} {...buttonProps}>{inner}</button>;
}
