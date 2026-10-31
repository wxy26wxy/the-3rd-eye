import { useId, type ComponentProps } from "react";
import styles from "./Field.module.css";

type Base = { label: string; hint?: string; error?: string | null; className?: string; /** Where the hint sits; "below" puts it under the control (creator code board). */ hintPosition?: "above" | "below" };
type InputProps = Base & { multiline?: false } & Omit<ComponentProps<"input">, "className">;
type AreaProps = Base & { multiline: true } & Omit<ComponentProps<"textarea">, "className">;

/** Labelled text input or textarea with hint and error wired to aria-describedby. */
export function Field(props: InputProps | AreaProps) {
  const autoId = useId();
  const { label, hint, error, className, multiline, id: givenId, hintPosition = "above", ...rest } = props;
  const id = givenId ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  const common = { id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, className: styles.control };
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      {hint && hintPosition === "above" ? <p id={hintId} className={styles.hint}>{hint}</p> : null}
      {multiline
        ? <textarea rows={4} {...common} {...(rest as Omit<ComponentProps<"textarea">, "className">)} />
        : <input type="text" {...common} {...(rest as Omit<ComponentProps<"input">, "className">)} />}
      {hint && hintPosition === "below" ? <p id={hintId} className={styles.hint}>{hint}</p> : null}
      {error ? <p id={errId} className={styles.error} role="alert">{error}</p> : null}
    </div>
  );
}

/** Native checkbox exposed as a switch; works inside plain forms. */
export function Switch({ label, hint, className, ...rest }: { label: string; hint?: string; className?: string } & Omit<ComponentProps<"input">, "type" | "className" | "role">) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={[styles.switchRow, className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={styles.switchLabel}>
        <span className={styles.label}>{label}</span>
        {hint ? <span id={hintId} className={styles.hint}>{hint}</span> : null}
      </label>
      <input id={id} type="checkbox" role="switch" aria-describedby={hintId} className={styles.switch} {...rest} />
    </div>
  );
}
