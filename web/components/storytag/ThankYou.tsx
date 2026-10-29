import type { TagThankYou } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { Card } from "@/components/ui/Card";
import { Stack } from "@/components/ui/Layout";
import { Muted, Title } from "@/components/ui/Text";
import { tagMediaSrc } from "./media";
import styles from "./StoryTag.module.css";

/** The creator's thank-you for this order: note, picture and/or captioned video. */
export function ThankYou({ thankYou, token, name }: { thankYou: TagThankYou | null; token: string; name: string }) {
  return (
    <section aria-labelledby="thanks-title">
      <Card pad="l" tone="white">
        <Stack gap="m">
          <Title id="thanks-title">{fmt(m.tag.thankYouTitle, { name })}</Title>
          {!thankYou ? <Muted>{fmt(m.tag.thankYouEmpty, { name })}</Muted> : (
            <>
              {thankYou.text ? <p className={styles.thanksText}>{thankYou.text}</p> : null}
              {thankYou.imageUrl ? (
                <ArtImage src={tagMediaSrc(thankYou.imageUrl, token)} alt={fmt(m.tag.thankYouImageAlt, { name })} ratio="auto" />
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
        </Stack>
      </Card>
    </section>
  );
}
