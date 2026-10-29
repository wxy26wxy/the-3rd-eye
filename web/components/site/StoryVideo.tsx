import type { PublicCreator } from "@/lib/db/queries.contract";
import { m } from "@/components/messages";
import { Tag } from "@/components/Tag";
import styles from "./StoryVideo.module.css";

/**
 * Creator story video with an English captions track. Private pathnames are served by
 * the backend through /media/{pathname}; `tagToken` scopes access from a story-tag page.
 */
export function StoryVideo({ creator, tagToken }: { creator: Pick<PublicCreator, "id" | "displayName" | "storyVideoUrl" | "storyVideoVtt">; tagToken?: string }) {
  if (!creator.storyVideoUrl) {
    return (
      <div className={styles.empty}>
        <Tag pose="waving" decorative className={styles.tag} />
        <p>{m.common.noVideo}</p>
      </div>
    );
  }
  const q = tagToken ? `?tag=${encodeURIComponent(tagToken)}` : "";
  const src = `/media/${creator.storyVideoUrl.split("/").map(encodeURIComponent).join("/")}${q}`;
  return (
    <video className={styles.video} controls playsInline preload="metadata" aria-label={creator.displayName}>
      <source src={src} />
      {creator.storyVideoVtt ? <track kind="captions" src={`/captions/${creator.id}`} srcLang="en" label={m.common.videoCaptions} default /> : null}
    </video>
  );
}
