"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmt, m } from "@/components/messages";
import { PlayIcon } from "@/components/ui/Icons";
import styles from "./StoryVideo.module.css";

/**
 * A <video> with native controls and a real play button (64 px white circle) over it until it plays.
 * With `autoPlay` the video starts by itself muted (what phones allow without a tap; the captions stay
 * on) and a "Tap for sound" button unmutes it; under prefers-reduced-motion, or when the browser
 * refuses (Low Power Mode, data saver), nothing starts and the play button stays. The buttons call
 * play() themselves: on iOS Safari the native inline controls were not drawn and a tap on the video
 * did nothing (2026-11-04), so the page's own buttons are the one reliable way to start it.
 */
export function VideoPoster({ label, children, className, videoClassName, autoPlay = false }: {
  label: string; children: ReactNode; className?: string; videoClassName?: string; autoPlay?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(autoPlay);
  useEffect(() => {
    const v = ref.current;
    if (!v || !autoPlay) return;
    // State follows the element's own events (onVolumeChange), never a setState inside the effect.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { v.muted = false; return; }
    v.muted = true; // the property is what autoplay checks; the attribute alone is not enough everywhere
    v.play().catch(() => { v.muted = false; }); // refused: the play button stays, with sound
  }, [autoPlay]);
  const playWithSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    void v.play().catch(() => { /* the native controls remain */ });
  };
  return (
    <div className={className}>
      <video
        ref={ref} className={videoClassName} controls playsInline preload={autoPlay ? "auto" : "metadata"} autoPlay={autoPlay} muted={muted}
        aria-label={label} onPlay={() => setStarted(true)} onVolumeChange={() => setMuted(ref.current?.muted ?? false)}
      >
        {children}
      </video>
      {started ? null : (
        <button type="button" className={styles.play} aria-label={fmt(m.common.playVideo, { name: label })} onClick={playWithSound}>
          <PlayIcon size="1.75rem" />
        </button>
      )}
      {started && muted ? <button type="button" className={styles.sound} onClick={playWithSound}>{m.common.tapForSound}</button> : null}
    </div>
  );
}
