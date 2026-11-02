import { describe, expect, it } from "vitest";
import { boxRescueArtworkId, percentRect, productNotice, usableSize } from "@/components/create/cutout";
import { api, ApiError } from "@/components/create/api";

const IMG = { w: 1200, h: 1600 };

describe("usableSize", () => {
  it("needs a positive finite width and height", () => {
    expect(usableSize(IMG)).toBe(true);
    expect(usableSize({ w: 0, h: 10 })).toBe(false);
    expect(usableSize(null)).toBe(false);
  });
});

describe("percentRect", () => {
  it("expresses a bbox as percentages of the image", () => {
    expect(percentRect([120, 160, 600, 800], IMG)).toEqual({ left: 10, top: 10, width: 40, height: 40 });
    expect(percentRect([1, 2, 3], IMG)).toBeNull();
  });
});

describe("productNotice", () => {
  const copy = { failed: "F.", unpublished: "U." };
  it("says nothing when products are fine", () => {
    expect(productNotice({ failedProductIds: [], unpublishedProductIds: [] }, copy)).toBeNull();
    expect(productNotice(undefined, copy)).toBeNull();
  });
  it("one line per kind of trouble", () => {
    expect(productNotice({ failedProductIds: ["p"], unpublishedProductIds: [] }, copy)).toBe("F.");
    expect(productNotice({ failedProductIds: ["p"], unpublishedProductIds: ["q"] }, copy)).toBe("F. U.");
  });
});

describe("zero-pieces box path", () => {
  it("boxRescueArtworkId reads the artwork id of a 422 no_drawing_found only", () => {
    expect(boxRescueArtworkId(new ApiError(422, "no_drawing_found", "x", { artworkId: "a1" }))).toBe("a1");
    expect(boxRescueArtworkId(new ApiError(422, "no_drawing_found", "x"))).toBeNull();
    expect(boxRescueArtworkId(new ApiError(504, "deadline_exceeded", "x", { artworkId: "a1" }))).toBeNull();
    expect(boxRescueArtworkId(new Error("x"))).toBeNull();
  });
  it("the web ApiError keeps the extra fields of the API error (artworkId)", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => Response.json({ error: { code: "no_drawing_found", message: "Nothing found", artworkId: "a9" } }, { status: 422 })) as typeof fetch;
    try {
      const err = await api("artworks", { json: {} }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).artworkId).toBe("a9");
      expect((err as ApiError).message).toBe("Nothing found");
      expect(boxRescueArtworkId(err)).toBe("a9");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

