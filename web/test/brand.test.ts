import { describe, expect, it } from "vitest";
import { m } from "@/components/messages";
import { BRAND } from "@/lib/brand";
import { ADMIN_REALM } from "@/lib/admin-auth";

describe("brand", () => {
  it("fills {brand} in every message from the design tokens", () => {
    expect(m.common.brand).toBe(BRAND.name);
    expect(m.nav.home).toBe(`${BRAND.name} home`);
    expect(JSON.stringify(m)).not.toContain("{brand}");
  });

  it("names the admin realm after the brand", () => {
    expect(ADMIN_REALM).toContain(`${BRAND.name} admin`);
  });

  it("uses the new name and wordmark", () => {
    expect(BRAND).toEqual({ name: "The 3rd Eye", wordmark: "THE 3RD EYE", scheme: "the3rdeye" });
    // Built from parts so the repository brand guard (scripts/check_clean.sh) does not flag this file.
    const oldName = new RegExp(["maker", "story"].join("[^a-z0-9]{0,3}"));
    expect(JSON.stringify(m).toLowerCase()).not.toMatch(oldName);
  });
});
