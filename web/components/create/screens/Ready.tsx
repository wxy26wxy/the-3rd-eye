"use client";
import { fmt, m } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button } from "@/components/ui/Button";
import { Title } from "@/components/ui/Text";
import { NoticeCard } from "../cards";
import { CreateScreen, MissingState } from "../CreateScreen";
import { cutoutOf, productPicture, resetDraft, useCreate } from "../store";
import styles from "../Create.module.css";

/**
 * Your sticker / tote bag is ready (boards `2030:3726`, `4038:4644` tote, notice `2038:4443`): logo (no Back), centred title, the
 * product picture (the bordered sticker preview, R1; the tote's AI mockup photo, T130 ruling), the cutout notice card when the last cleanup reported one, the question, and
 * Yes, list it! / Not now in the bar.
 */
export function Ready() {
  const { ready, draft } = useCreate();
  const p = draft.productRecord;
  if (ready && !p) return <MissingState />;
  const tote = (p?.type ?? draft.product) === "tote";
  const art = cutoutOf(draft, p?.artworkId);
  // A sticker: the bordered preview with a soft shadow; a tote: its mockup photo on the grey card.
  const picture = (
    <ArtImage
      src={productPicture(p, art)}
      alt={art?.altText ?? fmt(m.create.ready.mockupAlt, { product: tote ? m.common.tote : m.common.sticker })}
      placeholder={m.common.imageMissing}
      eager
      className={[styles.readyArt, tote ? "" : styles.stickerShadow].filter(Boolean).join(" ")}
    />
  );
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
      {tote ? <div className={styles.readyCard}>{picture}</div> : picture}
      {draft.cutoutNotice ? <NoticeCard>{draft.cutoutNotice}</NoticeCard> : null}
      <Title as="p" size="l">{m.create.ready.question}</Title>
    </CreateScreen>
  );
}
