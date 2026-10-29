"use client";
import { fmt, m } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Title } from "@/components/ui/Text";
import { CreateScreen, MissingState } from "../CreateScreen";
import { resetDraft, useCreate } from "../store";

export function Ready() {
  const { ready, draft } = useCreate();
  const p = draft.productRecord;
  if (ready && !p) return <MissingState />;
  const tote = (p?.type ?? draft.product) === "tote";
  const art = draft.variants?.find((v) => v.id === p?.artworkId);
  return (
    <CreateScreen
      title={tote ? m.create.ready.titleTote : m.create.ready.titleSticker}
      mascot="cheering"
      footer={
        <>
          <Title as="p" size="m">{m.create.ready.question}</Title>
          <Button block href="/create/listing">{m.create.ready.yes}</Button>
          <Button block variant="secondary" arrow={false} href="/create" onClick={() => resetDraft()}>{m.create.ready.no}</Button>
        </>
      }
    >
      <Card pad="s">
        <ArtImage
          src={p?.mockupUrl ?? art?.cleanedUrl ?? null}
          alt={art?.altText ?? fmt(m.create.ready.mockupAlt, { product: tote ? m.common.tote : m.common.sticker })}
          placeholder={m.common.imageMissing}
          eager
        />
      </Card>
    </CreateScreen>
  );
}
