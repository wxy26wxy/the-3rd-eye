"use client";
import { useId, useState } from "react";
import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { PlayIcon, VideoIcon } from "@/components/ui/Icons";
import type { Creator } from "./api";
import { ErrorCard } from "./cards";
import { useCreator } from "./store";
import styles from "./Create.module.css";

const r = m.create.myStory;

/** A private Blob pathname → the backend's media route (a creator's current story video is public there). */
export function mediaSrc(pathname: string): string {
  return `/media/${pathname.split("/").map(encodeURIComponent).join("/")}`;
}

export type StoryVideoRowViewProps = {
  creator: Pick<Creator, "id" | "storyVideoUrl" | "storyVideoVtt">;
  watching: boolean;
  /** The video could not be loaded. */
  failed?: boolean;
  onWatch: () => void;
  onFail?: () => void;
};

/**
 * My story video (R6), under the product choice on Choose a product: the first frame (or a video icon),
 * "My story video", where buyers see it (or "No story video yet"); Watch opens the player with
 * captions; Record again opens the story video screen, which returns here after saving. The API has
 * no recording date yet (follow-up: `storyVideoAt`).
 */
export function StoryVideoRowView({ creator, watching, failed, onWatch, onFail }: StoryVideoRowViewProps) {
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
          <h2 id={`${uid}-title`} className={styles.storyRowTitle}>{r.row}</h2>
          <p className={has ? undefined : styles.storyRowMeta}>{has ? r.saved : r.none}</p>
        </div>
      </div>
      <div className={styles.storyRowActions}>
        {has ? (
          <Button variant="secondary" arrow={false} icon={<PlayIcon />} onClick={onWatch} aria-expanded={watching} aria-controls={`${uid}-player`}>
            {r.watch}
          </Button>
        ) : null}
        <Button variant="secondary" arrow={false} href="/create/story-video?redo=1">{has ? r.recordAgain : m.create.story.record}</Button>
      </div>
      {src ? (
        <div id={`${uid}-player`} hidden={!watching}>
          {watching ? (
            <video className={styles.storyPlayer} controls playsInline preload="metadata" aria-label={r.title} onError={onFail}>
              <source src={src} onError={onFail} />
              {creator.storyVideoVtt ? <track kind="captions" src={`/captions/${creator.id}`} srcLang="en" label={m.common.videoCaptions} default /> : null}
            </video>
          ) : null}
          {watching && failed ? <ErrorCard live="status">{r.missing}</ErrorCard> : null}
        </div>
      ) : null}
    </section>
  );
}

/** The row with the signed-in creator (`GET /creators/me`); nothing until it has loaded. */
export function StoryVideoRow() {
  const { creator } = useCreator();
  const [watching, setWatching] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!creator) return null;
  return <StoryVideoRowView creator={creator} watching={watching} failed={failed} onWatch={() => setWatching((w) => !w)} onFail={() => setFailed(true)} />;
}
