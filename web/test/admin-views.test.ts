import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fmt, m } from "@/components/messages";
import { BRAND } from "@/lib/brand";
import { AdminShell } from "@/components/admin/AdminShell";
import { CodeCard } from "@/components/admin/CodeCard";
import { StatusButtons } from "@/components/admin/StatusButtons";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const c = m.admin.creators;
const issued = { at: 1, message: "Ana P. is added. Here is their code.", displayName: "Ana P.", code: "SAMPLE-00", signInUrl: "https://example.test/create/code#c=SAMPLE-00", qrUrl: "https://example.test/create/code?c=SAMPLE-00", appUrl: "the3rdeye://code/SAMPLE-00" };

describe("Admin (T106, boards 2031:3895 / 2034:3995)", () => {
  it("header reads {brand} · Admin from lib/brand", () => {
    const out = html(createElement(AdminShell, null, "x"));
    expect(m.admin.header).toBe(`${BRAND.name} · Admin`);
    expect(out).toContain(`>${m.admin.header}</span>`);
    expect(out).toContain('<main id="main"');
  });

  it("status: every other status as a Mark {status} pill", () => {
    const labels = { placed: "placed", printing: "printing", shipped: "shipped", delivered: "delivered" } as const;
    const out = html(createElement(StatusButtons, { action: async () => ({}), orderId: "o1", current: "printing", statuses: ["placed", "printing", "shipped", "delivered"], labels }));
    expect(out.match(/<button[^>]*name="status"/g)).toHaveLength(3);
    expect(out).toContain(fmt(m.admin.moveTo, { status: "placed" }));
    expect(out).not.toContain(fmt(m.admin.moveTo, { status: "printing" }));
  });

  it("code card: live region always mounted; when issued it holds the message and code, then QR, three copies, notes, Done", () => {
    const empty = html(createElement(CodeCard, { issued: null, onDone: () => {} }));
    expect(empty).toBe('<div><div aria-live="polite" aria-atomic="true" class="' + empty.split('class="')[1].split('"')[0] + '"></div></div>');
    const out = html(createElement(CodeCard, { issued, onDone: () => {} }));
    const live = out.slice(out.indexOf('aria-live="polite"'), out.indexOf("</div>", out.indexOf('aria-live="polite"')));
    expect(live).toContain(issued.message);
    expect(live).toContain("SAMPLE-00");
    expect(live).not.toContain(c.copyCode);
    expect(out).toContain(`aria-label="${fmt(c.qrLabel, { name: "Ana P." })}"`);
    expect(out).toContain(c.copyCode);
    expect(out.match(new RegExp(c.copyLink, "g"))).toHaveLength(2);
    expect(out).toContain(issued.appUrl);
    for (const t of [c.onceNote, c.sensitive]) expect(out).toContain(t);
    expect(out.indexOf(c.sensitive)).toBeLessThan(out.indexOf(c.dismiss));
  });
});
