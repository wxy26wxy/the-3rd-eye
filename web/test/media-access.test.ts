import { describe, expect, it } from "vitest";
import { canReadMedia, type MediaRequest } from "@/lib/media-access";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const print = `creators/${A}/print/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png`;
const original = `creators/${A}/originals/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png`;
const thankYouVideo = `creators/${A}/thank-you/cccccccc-cccc-cccc-cccc-cccccccccccc.mp4`;
const otherThankYou = `creators/${A}/thank-you/dddddddd-dddd-dddd-dddd-dddddddddddd.mp4`;
const mockup = `creators/${A}/mockups/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee.png`;
const storyVideo = `creators/${A}/video/ffffffff-ffff-ffff-ffff-ffffffffffff.mp4`;

const base: MediaRequest = { pathname: print, isAdmin: false, creatorId: null, tagFiles: null, isStoryVideo: false };
const can = (o: Partial<MediaRequest>) => canReadMedia({ ...base, ...o });

describe("media authorization matrix", () => {
  it("creator: own files yes, another creator's private files no", () => {
    expect(can({ creatorId: A, pathname: print })).toBe(true);
    expect(can({ creatorId: A, pathname: original })).toBe(true);
    expect(can({ creatorId: B, pathname: print })).toBe(false);
    expect(can({ creatorId: B, pathname: original })).toBe(false);
  });

  it("valid tag: only that order's thank-you media, never print files or originals", () => {
    const tagFiles = [thankYouVideo];
    expect(can({ tagFiles, pathname: thankYouVideo })).toBe(true);
    expect(can({ tagFiles, pathname: print })).toBe(false);
    expect(can({ tagFiles, pathname: original })).toBe(false);
  });

  it("tag for another order (or unknown tag) grants nothing private", () => {
    expect(can({ tagFiles: [otherThankYou], pathname: thankYouVideo })).toBe(false);
    expect(can({ tagFiles: [], pathname: thankYouVideo })).toBe(false);
    expect(can({ tagFiles: null, pathname: thankYouVideo })).toBe(false);
  });

  it("admin reads everything", () => {
    expect(can({ isAdmin: true, pathname: print })).toBe(true);
    expect(can({ isAdmin: true, pathname: original })).toBe(true);
  });

  it("public kinds and a current story video are public; anonymous gets nothing else", () => {
    expect(can({ pathname: mockup })).toBe(true);
    expect(can({ pathname: storyVideo, isStoryVideo: true })).toBe(true);
    expect(can({ pathname: storyVideo })).toBe(false);
    expect(can({ pathname: print })).toBe(false);
  });

  it("rejects traversal and absolute paths", () => {
    expect(can({ isAdmin: true, pathname: `creators/${A}/../${B}/print/x.png` })).toBe(false);
    expect(can({ isAdmin: true, pathname: "/etc/passwd" })).toBe(false);
  });
});
