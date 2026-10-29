import { describe, expect, it } from "vitest";
import { uploadRule } from "@/lib/uploads";
import { POST } from "@/app/api/v1/uploads/route";

const id = "11111111-1111-1111-1111-111111111111";
const u = "22222222-2222-2222-2222-222222222222";
const MB = 1024 * 1024;

describe("upload limits", () => {
  it("caps images at 25 MB, video at 200 MB, audio at 10 MB", () => {
    expect(uploadRule(`creators/${id}/photo/${u}.jpg`).maxBytes).toBe(25 * MB);
    expect(uploadRule(`creators/${id}/story-video/${u}.mov`).maxBytes).toBe(200 * MB);
    expect(uploadRule(`creators/${id}/thank-you/${u}.mp4`).maxBytes).toBe(200 * MB);
    expect(uploadRule(`creators/${id}/thank-you/${u}.jpg`).maxBytes).toBe(25 * MB);
    expect(uploadRule(`creators/${id}/audio/${u}.wav`).maxBytes).toBe(10 * MB);
    expect(uploadRule(`creators/${id}/audio/${u}.wav`).types).toContain("audio/wav");
  });

  it("never allows SVG", () => {
    expect(uploadRule(`creators/${id}/photo/${u}.png`).types.some((t) => t.includes("svg") || t === "image/*")).toBe(false);
    expect(() => uploadRule(`creators/${id}/photo/${u}.svg`)).toThrow(/SVG/);
  });

  it("answers 400 for a malformed JSON body", async () => {
    const res = await POST(new Request("http://x/api/v1/uploads", { method: "POST", body: "{not json" }), undefined);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_json");
  });
});
