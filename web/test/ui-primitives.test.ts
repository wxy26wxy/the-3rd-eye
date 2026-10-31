import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { m } from "@/components/messages";
import { ASSETS } from "@/lib/assets";
import { Mascot } from "@/components/ui/Mascot";
import { LogoMark } from "@/components/ui/LogoMark";
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

  it("magnifier falls back to the still pose under reduced motion", () => {
    const out = html(createElement(Mascot, { pose: "magnifier" }));
    expect(out).toContain('media="(prefers-reduced-motion: reduce)"');
    expect(out).toContain(`srcSet="${ASSETS.mascotFront}"`);
    expect(out).toContain(`src="${ASSETS.mascotMagnifier}"`);
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
