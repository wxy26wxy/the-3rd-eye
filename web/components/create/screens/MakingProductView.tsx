import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { StickerLoading } from "../art";
import { CreateScreen } from "../CreateScreen";
import { ErrorNotice, type ScreenError } from "../errors";

const k = m.create.making;

/**
 * Making your sticker (`4031:4378`) / tote bag (`4038:4628`): no logo or Back while busy, the title and
 * copy, the sticker-loading animation (decorative; first frame under reduced motion), the status line,
 * and the dimmed Use this in the bar. On failure: the error card with Try again, Back to Your cutout.
 */
export function MakingProductView({ tote, status, error, onRetry }: { tote: boolean; status: string; error: ScreenError | null; onRetry: () => void }) {
  return (
    <CreateScreen
      bare={!error}
      back={error ? "/create/cutout" : undefined}
      title={tote ? k.titleTote : k.titleSticker}
      lead={tote ? k.copyTote : k.copySticker}
      footer={error ? null : <Button block disabled aria-busy="true">{m.create.select.use}</Button>}
    >
      <StickerLoading />
      {error ? <ErrorNotice error={error} onRetry={onRetry} /> : <Loading inline label={status} />}
    </CreateScreen>
  );
}
