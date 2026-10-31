import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { omit } from "./omit";
import styles from "./Button.module.css";

type Variant = "primary" | "white" | "secondary" | "ghost" | "danger";
type Common = { variant?: Variant; arrow?: boolean; block?: boolean; icon?: ReactNode; children: ReactNode; className?: string };
type AsLink = Common & { href: string } & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">;
type AsButton = Common & { href?: undefined } & Omit<ComponentProps<"button">, "className" | "children">;

function cls(variant: Variant, block?: boolean, extra?: string, arrow?: boolean) {
  return [styles.btn, styles[variant], block ? styles.block : "", arrow ? styles.hasArrow : "", extra ?? ""].filter(Boolean).join(" ");
}

/**
 * Pill action (Sky). primary: 56 px ink pill, white label, 48 px arrow circle at the right (on by default).
 * white: the same on a photo. secondary: 50 px white pill with a border. ghost: underlined text action.
 */
export function Button(props: AsLink | AsButton) {
  const { variant = "primary", block, icon, children, className } = props;
  const arrow = props.arrow ?? (variant === "primary" || variant === "white");
  const inner = (
    <>
      {icon ? <span className={styles.icon} aria-hidden="true">{icon}</span> : null}
      <span className={styles.label}>{children}</span>
      {arrow ? <ArrowBubble /> : null}
    </>
  );
  if (props.href !== undefined) {
    const { href, ...linkProps } = omit(props as AsLink, ["variant", "arrow", "block", "icon", "children", "className"]);
    return <Link href={href} className={cls(variant, block, className, arrow)} {...linkProps}>{inner}</Link>;
  }
  const { type = "button", ...buttonProps } = omit(props as AsButton, ["variant", "arrow", "block", "icon", "children", "className", "href"]);
  return <button type={type} className={cls(variant, block, className, arrow)} {...buttonProps}>{inner}</button>;
}

export function ArrowBubble() {
  return (
    <span className={styles.arrow} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h13M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}

/** Non-interactive element that looks like a Button (e.g. the visible face of a file input's label). */
export function ButtonFace({ variant = "primary", block, icon, arrow = false, children }: { variant?: Variant; block?: boolean; icon?: ReactNode; arrow?: boolean; children: ReactNode }) {
  return (
    <span className={cls(variant, block, undefined, arrow)} aria-hidden="true">
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <span className={styles.label}>{children}</span>
      {arrow ? <ArrowBubble /> : null}
    </span>
  );
}
