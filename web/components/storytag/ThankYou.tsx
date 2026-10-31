import type { TagThankYou } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { Eyebrow } from "@/components/ui/Text";
import { tagMediaSrc } from "./media";
import styles from "./StoryTag.module.css";

/**
 * The creator's thank-you for this order (board: green Info card, the title as its caps eyebrow):
 * note, picture and/or captioned video. Before one arrives, the same card in white with the empty line.
 */
export function ThankYou({ thankYou, token, name }: { thankYou: TagThankYou | null; token: string; name: string }) {
  return (
    <section aria-labelledby="thanks-title" className={[styles.thanks, thankYou ? styles.thanksGreen : ""].filter(Boolean).join(" ")}>
      <Eyebrow as="h2" id="thanks-title" tone={thankYou ? "accent" : "muted"}>{fmt(m.tag.thankYouTitle, { name })}</Eyebrow>
      {!thankYou ? <p className={styles.thanksText}>{fmt(m.tag.thankYouEmpty, { name })}</p> : (
        <>
          {thankYou.text ? <p className={styles.thanksText}>{thankYou.text}</p> : null}
          {thankYou.imageUrl ? (
            <ArtImage className={styles.thanksMedia} src={tagMediaSrc(thankYou.imageUrl, token)} alt={fmt(m.tag.thankYouImageAlt, { name })} ratio="auto" />
          ) : null}
          {thankYou.videoUrl ? (
            <video className={styles.thanksVideo} controls playsInline preload="metadata" aria-label={fmt(m.tag.thankYouVideoLabel, { name })}>
              <source src={tagMediaSrc(thankYou.videoUrl, token)} />
              {thankYou.videoVtt ? (
                <track kind="captions" src={`/captions/tag/${encodeURIComponent(token)}`} srcLang="en" label={m.common.videoCaptions} default />
              ) : null}
            </video>
          ) : null}
        </>
      )}
    </section>
  );
}
