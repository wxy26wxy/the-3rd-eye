import type { ComponentProps, ReactNode } from "react";
import { CheckIcon } from "./Icons";
import styles from "./ChoiceCard.module.css";

type Props = {
  title: string;
  description?: string;
  media?: ReactNode;
  badge?: ReactNode;
  className?: string;
} & Omit<ComponentProps<"input">, "className" | "children">;

/**
 * Big selectable card backed by a native radio input, so arrow keys, forms and
 * screen readers work without JavaScript. Put several inside a <fieldset>.
 * `badge` is a short line shown as an eyebrow above the title (Sky: "No pen needed!").
 */
export function ChoiceCard({ title, description, media, badge, className, type = "radio", ...input }: Props) {
  return (
    <label className={[styles.card, className].filter(Boolean).join(" ")}>
      <input type={type} className={styles.input} {...input} />
      {media ? <span className={styles.media} aria-hidden="true">{media}</span> : null}
      <span className={styles.body}>
        {badge ? <span className={styles.badge}>{badge}</span> : null}
        <span className={styles.title}>{title}</span>
        {description ? <span className={styles.desc}>{description}</span> : null}
      </span>
      <span className={styles.check} aria-hidden="true"><CheckIcon /></span>
    </label>
  );
}

export function ChoiceGroup({ legend, children, className, layout = "stack" }: { legend: string; children: ReactNode; className?: string; layout?: "stack" | "grid" }) {
  return (
    <fieldset className={[styles.group, layout === "grid" ? styles.grid : "", className].filter(Boolean).join(" ")}>
      <legend className="visually-hidden">{legend}</legend>
      {children}
    </fieldset>
  );
}
