import { Display } from "@/components/ui/Display";
import { CheckIcon } from "@/components/ui/Icons";
import { Container } from "@/components/ui/Layout";
import { SkyCard } from "@/components/ui/Loading";
import styles from "./Pages.module.css";

export type StaticItem = string | { text: string; id: string };

/**
 * Static page · Sky (boards 2025:2682 / 2025:2747 / 2025:2809): h1, intro and the sky picture (decorative)
 * on the left; the points as a checked list of cards on the right; the closing note on a grey card.
 * An item can carry an id so other pages can link to it (`/how-it-works#story-tags`).
 */
export function StaticPage({ title, intro, items, note }: { title: string; intro: string; items: StaticItem[]; note?: string }) {
  return (
    <Container className={styles.static}>
      <div className={styles.staticIntro}>
        <Display as="h1" size="web">{title}</Display>
        <p className={styles.lead}>{intro}</p>
        <SkyCard className={styles.staticSky} />
      </div>
      <div className={styles.points}>
        <ul role="list" className={styles.pointList}>
          {items.map((item) => {
            const { text, id } = typeof item === "string" ? { text: item, id: undefined } : item;
            return (
              <li key={text} id={id} className={styles.point}>
                <span className={styles.check} aria-hidden="true"><CheckIcon size="1.125rem" /></span>
                <span>{text}</span>
              </li>
            );
          })}
        </ul>
        {note ? <p className={styles.closing}>{note}</p> : null}
      </div>
    </Container>
  );
}
