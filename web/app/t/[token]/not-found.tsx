import { m } from "@/components/messages";
import { StoryTagShell } from "@/components/storytag/Shell";
import { Button } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { SkyCard } from "@/components/ui/Loading";
import { Eyebrow } from "@/components/ui/Text";
import styles from "@/components/storytag/StoryTag.module.css";

/** Story tag · Not active (board 2024:2556): sky card, STORY TAG, "This story tag is not active yet.", Go to the shop. */
export default function StoryTagNotFound() {
  return (
    <StoryTagShell>
      <div className={styles.missing}>
        <SkyCard className={styles.sky} />
        <Eyebrow tone="muted">{m.tag.eyebrow}</Eyebrow>
        <Display as="h1" size="l">{m.tag.notFound}</Display>
        <Button href="/" block>{m.notFound.home}</Button>
      </div>
    </StoryTagShell>
  );
}
