import { fmt, m } from "@/components/messages";
import { Display } from "@/components/ui/Display";
import styles from "./Shop.module.css";

const STEPS = [
  { title: m.shop.step1Title, copy: m.shop.step1Copy },
  { title: m.shop.step2Title, copy: m.shop.step2Copy },
  { title: m.shop.step3Title, copy: m.shop.step3Copy },
];

export function HowSteps({ id = "how" }: { id?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={styles.how}>
      <Display id={`${id}-title`} size="l">{m.shop.howTitle}</Display>
      <ol className={styles.steps} role="list">
        {STEPS.map((s, i) => (
          <li key={s.title} className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">{i + 1}</span>
            <h3 className={styles.stepTitle}><span className="visually-hidden">{fmt(m.shop.stepLabel, { n: i + 1 })}: </span>{s.title}</h3>
            <p>{s.copy}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
