"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { speak } from "@/components/speech";
import { Button } from "@/components/ui/Button";
import { Title } from "@/components/ui/Text";
import { MascotPicture } from "../art";
import { CreateScreen, MissingState } from "../CreateScreen";
import { resetDraft, useCreate } from "../store";

/**
 * You're live (board `2030:3958`): logo, centred title, the shop mascot picture (R7), "{title} is now
 * in the shop." (also spoken once on arrival), and Make another / See what buyers see in the bar.
 */
export function Live() {
  const router = useRouter();
  const { ready, draft } = useCreate();
  const title = draft.listingTitle ?? "";
  const spoken = useRef(false);
  useEffect(() => {
    if (ready && title && !spoken.current) { spoken.current = true; speak(fmt(m.create.live.spoken, { title })); }
  }, [ready, title]);
  if (ready && !draft.productRecord) return <MissingState />;
  const productId = draft.productRecord?.id;
  return (
    <CreateScreen
      title={m.create.live.title}
      align="center"
      footer={
        <>
          <Button block onClick={() => { resetDraft(); router.push("/create/product"); }}>{m.create.live.another}</Button>
          {productId ? <Button block variant="secondary" arrow={false} href={`/p/${productId}`}>{m.create.live.buyerView}</Button> : null}
        </>
      }
    >
      <MascotPicture kind="shop" />
      <Title as="p" size="l">{fmt(m.create.live.copy, { title })}</Title>
    </CreateScreen>
  );
}
