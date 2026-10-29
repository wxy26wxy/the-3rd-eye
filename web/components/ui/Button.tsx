import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Common = { variant?: Variant; arrow?: boolean; block?: boolean; icon?: ReactNode; children: ReactNode; className?: string };
type AsLink = Common & { href: string } & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">;
type AsButton = Common & { href?: undefined } & Omit<ComponentProps<"button">, "className" | "children">;

function cls(variant: Variant, block?: boolean, extra?: string) {
  return [styles.btn, styles[variant], block ? styles.block : "", extra ?? ""].filter(Boolean).join(" ");
}

/** Pill CTA. Primary: ink, cream text, lime circular arrow, hard shadow. */
export function Button(props: AsLink | AsButton) {
  const { variant = "primary", block, icon, children, className } = props;
  const arrow = props.arrow ?? variant === "primary";
  const inner = (
    <>
      {icon ? <span className={styles.icon} aria-hidden="true">{icon}</span> : null}
      <span className={styles.label}>{children}</span>
      {arrow ? <ArrowBubble /> : null}
    </>
  );
  const { variant: _variant, arrow: _arrow, block: _block, icon: _icon, children: _children, className: _className, ...rest } = props;
  if (rest.href !== undefined) {
    const { href, ...linkProps } = rest as Omit<AsLink, keyof Common>;
    return <Link href={href} className={cls(variant, block, className)} {...linkProps}>{inner}</Link>;
  }
  const { type = "button", ...buttonProps } = rest as Omit<AsButton, keyof Common>;
  return <button type={type} className={cls(variant, block, className)} {...buttonProps}>{inner}</button>;
}

export function ArrowBubble() {
  return (
    <span className={styles.arrow} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h13M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}
