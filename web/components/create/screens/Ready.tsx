"use client";
import { fmt, m } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button } from "@/components/ui/Button";
import { Title } from "@/components/ui/Text";
import { NoticeCard } from "../cards";
import { CreateScreen, MissingState } from "../CreateScreen";
import { cutoutOf, pictureOf, resetDraft, useCreate } from "../store";
import styles from "../Create.module.css";

/**
 * Your sticker / tote bag is ready (boards `2030:3726`, `4038:4644` tote, notice `2038:4443`): logo (no Back), centred title, the
 * product picture (the AI product photo for both types, round 3 ruling 1; a sticker's bordered preview until it exists), the cutout notice card when the last cleanup reported one, the question, and
 * Yes, list it! / Not now in the bar.
 */
export function Ready() {
  const { ready, draft } = useCreate();
  const p = draft.productRecord;
  if (ready && !p) return <MissingState />;
  const tote = (p?.type ?? draft.product) === "tote";
  const art = cutoutOf(draft, p?.artworkId);
  // The AI photo on the grey card; a sticker preview with a soft shadow so its white border reads.
  const pic = pictureOf(p, art);
  const picture = (
    <ArtImage
      src={pic.src}
      alt={art?.altText ?? fmt(m.create.ready.mockupAlt, { product: tote ? m.common.tote : m.common.sticker })}
      placeholder={m.common.imageMissing}
      eager
      className={[styles.readyArt, pic.kind === "sticker" ? styles.stickerShadow : ""].filter(Boolean).join(" ")}
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
      {pic.kind === "sticker" ? picture : <div className={styles.readyCard}>{picture}</div>}
      {draft.cutoutNotice ? <NoticeCard>{draft.cutoutNotice}</NoticeCard> : null}
      <Title as="p" size="l">{m.create.ready.question}</Title>
    </CreateScreen>
  );
}
