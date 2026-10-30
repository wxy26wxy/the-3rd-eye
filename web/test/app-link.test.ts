import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appCodeLink } from "@/lib/app-link";
import { BRAND } from "@/lib/brand";

describe("appCodeLink", () => {
  it("builds the iOS link from the brand scheme", () => {
    expect(appCodeLink("AB-CD12")).toBe("the3rdeye://code/AB-CD12");
    expect(appCodeLink("a b/c")).toBe(`${BRAND.scheme}://code/a%20b%2Fc`);
  });

  it("uses the scheme the iOS app registers", () => {
    const plist = readFileSync(path.resolve(__dirname, "../../ios/App/Info.plist"), "utf8");
    const schemes = plist.match(/<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>([^<]+)<\/string>/);
    expect(schemes?.[1]).toBe(BRAND.scheme);
  });
});
