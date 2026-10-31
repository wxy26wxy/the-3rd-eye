import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { m } from "@/components/messages";
import { ASSETS } from "@/lib/assets";
import { Mascot } from "@/components/ui/Mascot";
import { LogoMark } from "@/components/ui/LogoMark";
import { Loading } from "@/components/ui/Loading";
import { StepPill } from "@/components/ui/StepPill";
import { Scallop } from "@/components/ui/Scallop";
import { Starburst } from "@/components/ui/Starburst";
import { Tag } from "@/components/Tag";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("Sky UI primitives (T102)", () => {
  it("Mascot uses the asset and the alt text from en.json", () => {
    const out = html(createElement(Mascot, { pose: "book" }));
    expect(out).toContain(`src="${ASSETS.mascotBook}"`);
    expect(out).toContain(`alt="${m.mascot.book}"`);
    expect(out).toContain('loading="lazy"');
  });

  it("decorative Mascot has empty alt; eager loads eagerly", () => {
    const out = html(createElement(Mascot, { pose: "front", decorative: true, eager: true }));
    expect(out).toContain('alt=""');
    expect(out).toContain('loading="eager"');
  });

  it("magnifier plays the MP4 (never the GIF) with the still pose for reduced motion", () => {
    const out = html(createElement(Mascot, { pose: "magnifier" }));
    // the source is set in the browser only when motion is allowed (nothing downloads under reduced motion)
    expect(out).toContain(`data-src="${ASSETS.mascotMagnifierVideo}"`);
    expect(out).not.toMatch(/<video[^>]*\ssrc=/);
    expect(out).toMatch(/<video[^>]*preload="none"/);
    expect(out).toMatch(/<video[^>]*\bloop\b/);
    expect(out).toContain(`src="${ASSETS.mascotFront}"`);
    expect(out).not.toContain(".gif");
    expect(out).toContain(`aria-label="${m.mascot.magnifier}"`);
  });

  it("Loading sky variant never references the GIF", () => {
    const out = html(createElement(Loading, { label: "Finding", variant: "sky" }));
    expect(out).toContain(ASSETS.mascotMagnifierVideo);
    expect(out).not.toContain(".gif");
  });

  it("LogoMark is decorative unless labelled", () => {
    expect(html(createElement(LogoMark))).toContain('alt=""');
    expect(html(createElement(LogoMark, { label: "Home" }))).toContain('alt="Home"');
  });

  it("StepPill renders only visually hidden text", () => {
    const out = html(createElement(StepPill, { step: 1, total: 3, label: "Step 1 of 3" }));
    expect(out).toBe('<p class="visually-hidden">Step 1 of 3</p>');
  });

  it("Scallop and Starburst render nothing", () => {
    expect(html(createElement(Scallop))).toBe("");
    expect(html(createElement(Starburst, null, "New"))).toBe("");
  });

  it("Tag wraps Mascot", () => {
    const out = html(createElement(Tag, { pose: "waving" }));
    expect(out).toContain(`src="${ASSETS.mascotBook}"`);
    expect(out).toContain(`alt="${m.mascot.book}"`);
  });
});
