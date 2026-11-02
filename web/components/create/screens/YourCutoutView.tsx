import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { NoticeCard } from "../cards";
import { CreateScreen } from "../CreateScreen";
import styles from "../Create.module.css";

const t = m.create.select;

export type YourCutoutViewProps = {
  title: string;
  lead: string;
  back: string;
  /** The cut-out on the checkerboard; null when there is none to show (Use this stays off). */
  cut: { src: string; alt: string; aspectRatio?: string } | null;
  /** Product trouble reported by the last cleanup. */
  notice: string | null;
  on: { use: () => void; startOver: () => void };
};

/**
 * Your cutout (R3; board `2038:4233`): the cut-out on the checkerboard, the status line, the product
 * notice, then Use this / Start over in the bar. No edge tools: the area is set on Adjust the area.
 */
export function YourCutoutView({ on, ...p }: YourCutoutViewProps) {
  return (
    <CreateScreen
      back={p.back}
      title={p.title}
      lead={p.lead}
      footer={<>
        <Button block onClick={on.use} disabled={!p.cut}>{t.use}</Button>
        <Button block variant="secondary" arrow={false} onClick={on.startOver}>{m.common.startOver}</Button>
      </>}
    >
      {p.cut ? (
        <div className={styles.checker} style={p.cut.aspectRatio ? { aspectRatio: p.cut.aspectRatio } : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.cut.src} alt={p.cut.alt} />
        </div>
      ) : <NoticeCard>{m.common.imageMissing}</NoticeCard>}
      {p.cut ? <p className={styles.resultHeading}>{t.applied}</p> : null}
      {p.notice ? <NoticeCard>{p.notice}</NoticeCard> : null}
    </CreateScreen>
  );
}
