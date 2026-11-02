"use client";
import { fmt, m } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button } from "@/components/ui/Button";
import { Title } from "@/components/ui/Text";
import { NoticeCard } from "../cards";
import { CreateScreen, MissingState } from "../CreateScreen";
import { resetDraft, useCreate } from "../store";
import styles from "../Create.module.css";

/**
 * Your sticker / tote bag is ready (boards `2030:3726`, `4038:4644` tote, notice `2038:4443`): logo (no Back), centred title, the
 * product picture, the cutout notice card when the last cleanup reported one, the question, and
 * Yes, list it! / Not now in the bar.
 */
export function Ready() {
  const { ready, draft } = useCreate();
  const p = draft.productRecord;
  if (ready && !p) return <MissingState />;
  const tote = (p?.type ?? draft.product) === "tote";
  const art = draft.cutout?.artworkId === p?.artworkId ? draft.cutout : null;
  return (
    <CreateScreen
      title={tote ? m.create.ready.titleTote : m.create.ready.titleSticker}
      align="center"
      footer={
        <>
          <Button block href="/create/listing">{m.create.ready.yes}</Button>
          <Button block variant="secondary" arrow={false} href="/create" onClick={() => resetDraft()}>{m.create.ready.no}</Button>
        </>
      }
    >
      <ArtImage
        src={p?.mockupUrl ?? art?.cleanedUrl ?? null}
        alt={art?.altText ?? fmt(m.create.ready.mockupAlt, { product: tote ? m.common.tote : m.common.sticker })}
        placeholder={m.common.imageMissing}
        eager
        className={styles.readyArt}
      />
      {draft.cutoutNotice ? <NoticeCard>{draft.cutoutNotice}</NoticeCard> : null}
      <Title as="p" size="l">{m.create.ready.question}</Title>
    </CreateScreen>
  );
}
