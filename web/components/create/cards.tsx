import type { ReactNode } from "react";
import { WarningIcon } from "@/components/ui/Icons";
import { Eyebrow } from "@/components/ui/Text";
import styles from "./Create.module.css";

/**
 * Info card (Components page `2007:251`): caps eyebrow over a line of text ("YOU SAID",
 * "WHAT THE IMAGE SHOWS", "LISTENING", "YOUR STORY"). `green` = the clarifying question, `alt` =
 * the grey story card. Read as one group: the eyebrow names the text.
 */
export function InfoCard({ eyebrow, children, tone = "white", className, ...rest }: {
  eyebrow?: string; children: ReactNode; tone?: "white" | "green" | "alt"; className?: string; id?: string; "aria-live"?: "polite";
}) {
  return (
    <div className={[styles.infoCard, styles[`info-${tone}`], className].filter(Boolean).join(" ")} {...rest}>
      {eyebrow ? <Eyebrow tone={tone === "green" ? "accent" : "muted"}>{eyebrow}</Eyebrow> : null}
      <div className={styles.infoText}>{children}</div>
    </div>
  );
}

/**
 * Error card (Components page `2007:268`): warning icon, the message, and optional text actions
 * under it. Announced as an alert. Used for every creator-flow error and blocking hint.
 */
export function ErrorCard({ children, actions, id, live = "alert" }: { children: ReactNode; actions?: ReactNode; id?: string; live?: "alert" | "status" }) {
  return (
    <div className={styles.errorCard} role={live} id={id}>
      <span className={styles.errorIcon} aria-hidden="true"><WarningIcon /></span>
      <div className={styles.errorBody}>
        <p>{children}</p>
        {actions ? <div className={styles.errorActions}>{actions}</div> : null}
      </div>
    </div>
  );
}

/** A plain notice in a white card (e.g. the cutout product notice). Spoken politely. */
export function NoticeCard({ children }: { children: ReactNode }) {
  return <p className={styles.noticeCard} role="status">{children}</p>;
}
