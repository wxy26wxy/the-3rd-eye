import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { StickerLoading } from "../art";
import { CreateScreen } from "../CreateScreen";
import { ErrorNotice, type ScreenError } from "../errors";

const c = m.create.cutout;

/**
 * Making your cutout (board `2038:4369`): no logo or Back while busy, the title and copy, the
 * animation, "Cutting out your art…", and the dimmed Use this in the bar. The animation: the
 * searching magnifier while the crop of the frame is uploaded and cut (round 4: crop → upload →
 * `POST /artworks`), the creating-cutout video for a change result (R7; first frame under reduced
 * motion). On failure: the error card with Try again, and Back to the art in the bar.
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
      {error ? (
        <>{changed ? <StickerLoading /> : null}<ErrorNotice error={error} onRetry={onRetry} /></>
      ) : changed ? (
        <><StickerLoading /><Loading inline label={m.create.select.applying} /></>
      ) : <Loading variant="sky" label={m.create.select.applying} />}
    </CreateScreen>
  );
}
