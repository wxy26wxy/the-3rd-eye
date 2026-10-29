"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { speak } from "@/components/speech";
import { Button } from "@/components/ui/Button";
import { CreateScreen, MissingState } from "../CreateScreen";
import { resetDraft, useCreate } from "../store";

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
      lead={fmt(m.create.live.copy, { title })}
      mascot="cheering"
      footer={
        <>
          <Button block onClick={() => { resetDraft(); router.push("/create/product"); }}>{m.create.live.another}</Button>
          {productId ? <Button block variant="secondary" arrow={false} href={`/p/${productId}`}>{m.create.live.buyerView}</Button> : null}
        </>
      }
    />
  );
}
