"use client";
import { useState, type ReactNode } from "react";
import { PlayIcon } from "@/components/ui/Icons";
import styles from "./StoryVideo.module.css";

/**
 * A <video> with native controls and the Sky poster play button (64 px white circle) drawn over it
 * until it first plays. The button is decorative (pointer-events: none): the video's own controls and
 * click-to-play stay the one way to play, for mouse, touch, keyboard and screen readers alike.
 */
export function VideoPoster({ label, children, className, videoClassName }: { label: string; children: ReactNode; className?: string; videoClassName?: string }) {
  const [started, setStarted] = useState(false);
  return (
    <div className={className}>
      <video className={videoClassName} controls playsInline preload="metadata" aria-label={label} onPlay={() => setStarted(true)}>
        {children}
      </video>
      {started ? null : <span className={styles.play} aria-hidden="true"><PlayIcon size="1.75rem" /></span>}
    </div>
  );
}
