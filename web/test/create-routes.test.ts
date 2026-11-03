import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn((to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); });
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

describe("Round 3: retired creator routes", () => {
  it("/create/pattern (Choose a pattern is gone) and the old /create/select go to Adjust the area", async () => {
    const pattern = (await import("@/app/create/pattern/page")).default;
    const select = (await import("@/app/create/select/page")).default;
    expect(() => pattern()).toThrow("NEXT_REDIRECT /create/adjust");
    expect(() => select()).toThrow("NEXT_REDIRECT /create/adjust");
  });
});
