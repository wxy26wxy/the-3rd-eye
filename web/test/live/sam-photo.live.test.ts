/**
 * Opt-in live check (a few SAM calls per photo): LIVE_SAM=1 with META_API_KEY set. The test unsets
 * DATABASE_URL so no ai_calls rows are written.
 *   cd web && LIVE_SAM=1 LIVE_PHOTOS=/path/a.jpg,/path/b.png pnpm exec dotenv -e .env.local -- vitest run test/live
 * LIVE_PHRASES (comma-separated) prints what each phrase alone finds; without LIVE_PHOTOS a
 * synthetic scene is used. Writes the cut-outs to LIVE_OUT (default: os tmpdir) for a visual check.
 */
import { describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { MetaSegmenter } from "@/lib/ai/meta/sam";
import { pngRef } from "@/lib/image/ref";
import { alphaToMask, fillHoles, finishMask, area } from "@/lib/image/mask";
import { removeBackground } from "@/lib/image/sticker";

const live = process.env.LIVE_SAM === "1" && Boolean(process.env.META_API_KEY);

/** A toy-like object (bear with a ring handle and shading) on a wood-coloured table with a paper sheet. */
const scene = () => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
  <defs><radialGradient id="fur" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#c58b52"/><stop offset="1" stop-color="#7a4a22"/></radialGradient>
  <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b98a5e"/><stop offset="1" stop-color="#8d6440"/></linearGradient></defs>
  <rect width="1200" height="900" fill="url(#wood)"/>
  <rect x="120" y="80" width="960" height="740" fill="#f4f1ea"/>
  <circle cx="520" cy="300" r="70" fill="url(#fur)"/><circle cx="700" cy="300" r="70" fill="url(#fur)"/>
  <circle cx="610" cy="400" r="150" fill="url(#fur)"/>
  <ellipse cx="610" cy="640" rx="190" ry="160" fill="url(#fur)"/>
  <circle cx="560" cy="380" r="16" fill="#1d1208"/><circle cx="660" cy="380" r="16" fill="#1d1208"/>
  <ellipse cx="610" cy="450" rx="40" ry="28" fill="#e9d2b0"/>
  <ellipse cx="610" cy="650" rx="90" ry="80" fill="#e9d2b0"/>
  <circle cx="860" cy="560" r="70" fill="none" stroke="#d23b3b" stroke-width="26"/>
</svg>`)).png().toBuffer();

const probePhrases = (process.env.LIVE_PHRASES ?? "drawing,handmade object").split(",").filter(Boolean);
const photos = (process.env.LIVE_PHOTOS || "").split(",").filter(Boolean);

describe.skipIf(!live)("live SAM on photos of objects", () => {
  it("findCandidates + finishMask gives hole-free cuts", async () => {
    delete process.env.DATABASE_URL; // never write ai_calls rows from this check
    const out = process.env.LIVE_OUT || tmpdir();
    const inputs = photos.length ? await Promise.all(photos.map(async (p) => sharp(p).rotate().png().toBuffer())) : [await scene()];
    const sam = new MetaSegmenter();
    for (const [n, png] of inputs.entries()) {
      const { width = 0, height = 0 } = await sharp(png).metadata();
      for (const phrase of probePhrases) {
        const raw = await sam.findAll(pngRef(png), phrase, { trace: { stage: "segment", task: "T080-live" } });
        console.log(`photo ${n} "${phrase}"`, raw.map((s) => ({ bbox: s.bbox, score: Math.round(s.score * 100) / 100, cover: Math.round((area(s.mask) / (width * height)) * 1000) / 1000 })));
      }
      const segs = (await sam.findCandidates(pngRef(png), { trace: { stage: "segment", task: "T080-live" } })).segments;
      console.log(`photo ${n} candidates:`, segs.map((s) => ({ bbox: s.bbox, score: Math.round(s.score * 100) / 100 })));
      expect(segs.length).toBeGreaterThan(0);
      for (const [i, s] of segs.entries()) {
        const alpha = await finishMask(s.mask, { width, height });
        writeFileSync(join(out, `t080-live-${n}-cand-${i}.png`), (await removeBackground(png, alpha)).png);
        const bin = alphaToMask(alpha);
        expect(area(fillHoles(bin))).toBe(area(bin)); // no interior holes left
      }
      const all = await finishMask(segs.map((s) => s.mask), { width, height });
      writeFileSync(join(out, `t080-live-${n}-union.png`), (await removeBackground(png, all)).png);
    }
  }, 300_000);
});
