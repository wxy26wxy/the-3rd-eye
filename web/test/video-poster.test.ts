import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StoryVideo } from "@/components/site/StoryVideo";
import { fmt, m } from "@/components/messages";

const creator = { id: "c1", displayName: "June Park", storyVideoUrl: "creators/c1/story-video/v.mp4", storyVideoVtt: "WEBVTT\n" };

describe("story video player (autoplay, 2026-11-04)", () => {
  it("story tag and creator pages: muted autoplay (from the effect) with a real play button and captions on", () => {
    const out = renderToStaticMarkup(createElement(StoryVideo, { creator, tagToken: "T1", autoPlay: true }));
    expect(out).not.toMatch(/autoplay/i); // started from the effect after hydration, never by the attribute (reduced motion first)
    expect(out).toMatch(/<video[^>]*muted=""/i);
    expect(out).toMatch(/<video[^>]*preload="auto"/);
    expect(out).toMatch(/<video[^>]*playsinline=""/i);
    expect(out).toMatch(new RegExp(`<button type="button"[^>]*aria-label="${fmt(m.common.playVideo, { name: "June Park" })}"`));
    expect(out).toContain('<source src="/media/creators/c1/story-video/v.mp4?tag=T1"/>');
    expect(out).toMatch(/<track kind="captions"[^>]*default=""/);
  });

  it("elsewhere: no autoplay, metadata preload, the same play button", () => {
    const out = renderToStaticMarkup(createElement(StoryVideo, { creator }));
    expect(out).not.toMatch(/autoplay/i);
    expect(out).toMatch(/<video[^>]*preload="metadata"/);
    expect(out).toMatch(/<button type="button"[^>]*aria-label=/);
    expect(out).not.toContain(m.common.turnSoundOn); // only while a muted autoplay runs
  });
});
