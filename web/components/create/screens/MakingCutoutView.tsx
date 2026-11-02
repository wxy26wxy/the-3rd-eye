import { m } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { CreateScreen } from "../CreateScreen";
import { ErrorNotice, type ScreenError } from "../errors";
import styles from "../Create.module.css";

const c = m.create.cutout;

/**
 * Making your cutout (board `2038:4369`): no logo or Back while busy, the title and copy, the changed
 * art on the photo card (dimmed), "Cutting out your art…", and the dimmed Use this in the bar. On
 * failure: the error card with Try again, and Back to the art in the bar.
 */
export function MakingCutoutView({ art, changed, error, back, onRetry }: {
  art: { src: string | null; alt: string }; changed: boolean; error: ScreenError | null; back: string; onRetry: () => void;
}) {
  return (
    <CreateScreen
      bare={!error}
      back={error ? back : undefined}
      title={c.makingTitle}
      lead={changed ? c.makingCopy : c.makingCopyOriginal}
      footer={error
        ? <Button block variant="secondary" arrow={false} href={back}>{m.create.drawing.back}</Button>
        : <Button block disabled aria-busy="true">{m.create.select.use}</Button>}
    >
      <div className={[styles.photoCard, error ? "" : styles.photoCardBusy].filter(Boolean).join(" ")}>
        <ArtImage src={art.src} alt={art.alt} placeholder={m.common.imageMissing} eager className={styles.cutArt} />
      </div>
      {error ? <ErrorNotice error={error} onRetry={onRetry} /> : <Loading inline label={m.create.select.applying} />}
    </CreateScreen>
  );
}
