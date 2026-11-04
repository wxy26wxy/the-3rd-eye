import type { PublicCreator } from "@/lib/db/queries.contract";
import { m } from "@/components/messages";
import { Mascot } from "@/components/ui/Mascot";
import { VideoPoster } from "./VideoPoster";
import styles from "./StoryVideo.module.css";

/**
 * Creator story video with an English captions track (board: "StoryVideo poster with play button").
 * Private pathnames are served by the backend through /media/{pathname}; `tagToken` scopes access from
 * a story-tag page. The video keeps its native controls; the page's own play button starts it, and with
 * `autoPlay` (story tag and creator pages) it starts muted by itself with a "Turn sound on" button.
 */
export function StoryVideo({ creator, tagToken, className, autoPlay }: { creator: Pick<PublicCreator, "id" | "displayName" | "storyVideoUrl" | "storyVideoVtt">; tagToken?: string; className?: string; autoPlay?: boolean }) {
  if (!creator.storyVideoUrl) {
    return (
      <div className={[styles.frame, styles.empty, className].filter(Boolean).join(" ")}>
        <Mascot pose="book" decorative className={styles.mascot} />
        <p>{m.common.noVideo}</p>
      </div>
    );
  }
  const q = tagToken ? `?tag=${encodeURIComponent(tagToken)}` : "";
  const src = `/media/${creator.storyVideoUrl.split("/").map(encodeURIComponent).join("/")}${q}`;
  return (
    <VideoPoster className={[styles.frame, className].filter(Boolean).join(" ")} videoClassName={styles.video} label={creator.displayName} autoPlay={autoPlay}>
      <source src={src} />
      {creator.storyVideoVtt ? <track kind="captions" src={`/captions/${creator.id}`} srcLang="en" label={m.common.videoCaptions} default /> : null}
    </VideoPoster>
  );
}
