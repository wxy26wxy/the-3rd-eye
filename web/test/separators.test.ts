import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fmt, m } from "@/components/messages";
import { Thread } from "@/components/storytag/Thread";
import type { TagMessage } from "@/lib/db/queries.contract";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

/** Source without comments (block, line and JSDoc), so only code and JSX text remain. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

describe("name and list separators come from en.json (T108)", () => {
  it("common.nameStudio joins a name and a studio; common.listSeparator joins list items", () => {
    expect(fmt(m.common.nameStudio, { name: "Rosa M.", studio: "Sunny Studio" })).toBe("Rosa M. · Sunny Studio");
    expect(["a", "b"].join(m.common.listSeparator)).toBe("a · b");
  });

  it("the thread's sender line uses the list separator", () => {
    const msg = { id: "m1", direction: "buyer_to_creator", body: "Hi", createdAt: "2026-10-31T10:00:00Z" } as unknown as TagMessage;
    const out = renderToStaticMarkup(createElement(Thread, { messages: [msg], name: "Rosa" }));
    expect(out).toContain(`${m.tag.fromYou}${m.common.listSeparator}<time`);
  });

  it("no component or page writes a literal ' · ' in code", () => {
    const root = path.resolve(__dirname, "..");
    const hits = [...files(path.join(root, "components")), ...files(path.join(root, "app"))]
      .filter((f) => code(readFileSync(f, "utf8")).includes("·"))
      .map((f) => path.relative(root, f));
    expect(hits).toEqual([]);
  });
});
