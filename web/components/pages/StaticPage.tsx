import { Display } from "@/components/ui/Display";
import { CheckIcon } from "@/components/ui/Icons";
import { Container } from "@/components/ui/Layout";
import Image from "next/image";
import { m } from "@/components/messages";
import { ASSETS } from "@/lib/assets";
import styles from "./Pages.module.css";

export type StaticItem = string | { text: string; id: string };

/**
 * Static page · Sky (boards 2025:2682 / 2025:2747 / 2025:2809): h1, intro and the mascot-with-a-drawing picture
 * (the founder's pick, 2026-11-04; the same picture as Upload a picture, described) on the left; the points as a checked list of cards on the right; the closing note on a grey card.
 * An item can carry an id so other pages can link to it (`/how-it-works#story-tags`).
 */
export function StaticPage({ title, intro, items, note }: { title: string; intro: string; items: StaticItem[]; note?: string }) {
  return (
    <Container className={styles.static}>
      <div className={styles.staticIntro}>
        <Display as="h1" size="web">{title}</Display>
        <p className={styles.lead}>{intro}</p>
        <Image src={ASSETS.mascotCard} width={1200} height={1023} alt={m.create.photo.mascotAlt} sizes="(min-width: 64rem) 32.5rem, 100vw" priority className={styles.staticPicture} />
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
