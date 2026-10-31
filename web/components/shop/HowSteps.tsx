import { fmt, m } from "@/components/messages";
import { Display } from "@/components/ui/Display";
import styles from "./Shop.module.css";

const STEPS = [
  { title: m.shop.step1Title, copy: m.shop.step1Copy },
  { title: m.shop.step2Title, copy: m.shop.step2Copy },
  { title: m.shop.step3Title, copy: m.shop.step3Copy },
];

/** "How a story tag works" (board 2018:1922): three step cards, the third on the green accent card. */
export function HowSteps({ id = "how" }: { id?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={styles.how}>
      <Display id={`${id}-title`} size="l">{m.shop.howTitle}</Display>
      <ol className={styles.steps} role="list">
        {STEPS.map((s, i) => (
          <li key={s.title} className={[styles.step, i === STEPS.length - 1 ? styles.stepAccent : ""].filter(Boolean).join(" ")}>
            <h3 className={styles.stepHeading}>
              <span className={styles.stepNum}>{fmt(m.shop.stepLabel, { n: i + 1 })}</span>
              <span className="visually-hidden">: </span>
              <span className={styles.stepTitle}>{s.title}</span>
            </h3>
            <p className={styles.stepCopy}>{s.copy}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
