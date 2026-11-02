import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { ArtPreview, TextAction } from "../art";
import { InfoCard } from "../cards";
import { CreateScreen } from "../CreateScreen";
import styles from "../Create.module.css";

const r = m.create.result;

export type BeforeAfterViewProps = {
  /** What the creator asked for. */
  asked: string;
  before: { src: string | null; alt: string };
  after: { src: string | null; alt: string };
  /** What the After picture shows, and (when the model names one) what differs from the request. */
  shows: string | null;
  differences: string;
  playing: boolean;
  on: { hear: () => void; use: () => void; again: () => void; original: () => void };
};

/**
 * Before and after (board `2027:3091`): Back, the title, YOU ASKED, the Before / After pair, what the
 * After picture shows (with "Hear what the image shows"), then Use this (to the cutout), Change it
 * again and "Back to my original" (restores Before; nothing is lost) in the pinned bar.
 */
export function BeforeAfterView({ on, ...p }: BeforeAfterViewProps) {
  return (
    <CreateScreen
      back="/create/change"
      title={r.title}
      footer={<>
        <Button block onClick={on.use}>{r.use}</Button>
        <Button block variant="secondary" arrow={false} onClick={on.again}>{r.change}</Button>
        <Button variant="ghost" arrow={false} onClick={on.original}>{r.backToPictures}</Button>
      </>}
    >
      <InfoCard eyebrow={r.youSaid}><p>{p.asked}</p></InfoCard>
      <div className={styles.artPair}>
        <ArtPreview label={r.before} src={p.before.src} alt={p.before.alt} />
        <ArtPreview label={r.after} src={p.after.src} alt={p.after.alt} />
      </div>
      {p.shows ? (
        <InfoCard eyebrow={r.shows}>
          <p>{p.shows}</p>
          {p.differences ? <p>{p.differences}</p> : null}
        </InfoCard>
      ) : null}
      {p.shows ? <TextAction onClick={on.hear} pressed={p.playing}>{p.playing ? r.stop : r.hear}</TextAction> : null}
    </CreateScreen>
  );
}
