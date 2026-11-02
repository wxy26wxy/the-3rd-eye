"use client";
import { useId, useState } from "react";
import { fmt, m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { PlayIcon, VideoIcon } from "@/components/ui/Icons";
import type { Creator } from "./api";
import { useCreator } from "./store";
import styles from "./Create.module.css";

const r = m.create.storyRow;
const DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

/** A private Blob pathname → the backend's media route (a creator's current story video is public there). */
export function mediaSrc(pathname: string): string {
  return `/media/${pathname.split("/").map(encodeURIComponent).join("/")}`;
}

/** "Recorded Nov 2, 2026" when the recording date is known, else a plain "saved" line. */
export function recordedLine(creator: Pick<Creator, "storyDraft">): string {
  const at = creator.storyDraft?.createdAt ? new Date(creator.storyDraft.createdAt) : null;
  return at && !Number.isNaN(at.getTime()) ? fmt(r.recorded, { date: DATE.format(at) }) : r.saved;
}

export type StoryVideoRowViewProps = {
  creator: Pick<Creator, "id" | "storyVideoUrl" | "storyVideoVtt" | "mentionDisability" | "storyDraft">;
  watching: boolean;
  onWatch: () => void;
};

/**
 * My story video (R6), under the product choice on Choose a product: the first frame (or a video icon),
 * "My story video", when it was recorded (or "No story video yet") and the "Mention my disability"
 * choice; Watch opens the player with captions; Record again opens the story video screen, which
 * returns here after saving.
 */
export function StoryVideoRowView({ creator, watching, onWatch }: StoryVideoRowViewProps) {
  const uid = useId();
  const has = !!creator.storyVideoUrl;
  const src = creator.storyVideoUrl ? mediaSrc(creator.storyVideoUrl) : null;
  return (
    <section className={styles.storyRow} aria-labelledby={`${uid}-title`}>
      <div className={styles.storyRowMain}>
        <div className={styles.storyThumb} aria-hidden="true">
          {src ? <video src={`${src}#t=0.1`} preload="metadata" muted playsInline tabIndex={-1} /> : <VideoIcon />}
        </div>
        <div className={styles.storyRowText}>
          <h2 id={`${uid}-title`} className={styles.storyRowTitle}>{r.title}</h2>
          <p>{has ? recordedLine(creator) : r.none}</p>
          {has ? <p className={styles.storyRowMeta}>{creator.mentionDisability ? r.mentionOn : r.mentionOff}</p> : null}
        </div>
      </div>
      <div className={styles.storyRowActions}>
        {has ? (
          <Button variant="secondary" arrow={false} icon={<PlayIcon />} onClick={onWatch} aria-expanded={watching} aria-controls={`${uid}-player`}>
            {watching ? r.hide : r.watch}
          </Button>
        ) : null}
        <Button variant="secondary" arrow={false} href="/create/story-video?redo=1">{has ? r.again : r.record}</Button>
      </div>
      {src ? (
        <div id={`${uid}-player`} hidden={!watching}>
          {watching ? (
            <video className={styles.storyPlayer} controls playsInline preload="metadata" aria-label={r.title}>
              <source src={src} />
              {creator.storyVideoVtt ? <track kind="captions" src={`/captions/${creator.id}`} srcLang="en" label={m.common.videoCaptions} default /> : null}
            </video>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** The row with the signed-in creator (`GET /creators/me`); nothing until it has loaded. */
export function StoryVideoRow() {
  const { creator } = useCreator();
  const [watching, setWatching] = useState(false);
  if (!creator) return null;
  return <StoryVideoRowView creator={creator} watching={watching} onWatch={() => setWatching((w) => !w)} />;
}
