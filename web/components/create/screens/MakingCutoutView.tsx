import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { StickerLoading } from "../art";
import { CreateScreen } from "../CreateScreen";
import { ErrorNotice, type ScreenError } from "../errors";

const c = m.create.cutout;

/**
 * Making your cutout (board `2038:4369`): no logo or Back while busy, the title and copy, the
 * creating-cutout animation (R7, the same as Making your sticker; first frame under reduced motion),
 * "Cutting out your art…", and the dimmed Use this in the bar. On failure: the error card with Try
 * again, and Back to the art in the bar.
 */
export function MakingCutoutView({ changed, error, back, onRetry }: {
  changed: boolean; error: ScreenError | null; back: string; onRetry: () => void;
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
      <StickerLoading />
      {error ? <ErrorNotice error={error} onRetry={onRetry} /> : <Loading inline label={m.create.select.applying} />}
    </CreateScreen>
  );
}
