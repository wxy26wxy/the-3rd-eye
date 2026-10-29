import styles from "./StepPill.module.css";

/** "STEP 1 OF 3" pill with progress dots. The label carries the meaning; dots are decorative. */
export function StepPill({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <p className={styles.pill}>
      <span>{label}</span>
      <span className={styles.dots} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < step ? styles.on : styles.dot} />
        ))}
      </span>
    </p>
  );
}
