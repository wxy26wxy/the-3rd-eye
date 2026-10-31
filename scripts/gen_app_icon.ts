/**
 * Renders the iOS app icon from design/tokens.json and the logo mark exported from the Figma file
 * (design/assets/logo-mark.svg, node "Union"): the ink eye mark centred on the accent green.
 * Output: ios/App/Assets.xcassets/AppIcon.appiconset/.
 * Run: pnpm icon   (or: pnpm --filter web exec tsx ../scripts/gen_app_icon.ts)
 * Swap: drop a 1024x1024 PNG at the same path to use a designer-made icon.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname ?? __dirname, "..");
const tokens = JSON.parse(readFileSync(resolve(root, "design/tokens.json"), "utf8"));
const c = tokens.color as Record<string, string>;
const S = 1024;

// The mark keeps its exported path; only its fill and placement change. 40x35 viewBox, scaled to 60% of the icon width.
const mark = readFileSync(resolve(root, "design/assets/logo-mark.svg"), "utf8");
const path = mark.match(/<path[^>]*\sd="([^"]+)"/)?.[1];
if (!path) throw new Error("logo-mark.svg: no path");
const { w, h } = tokens.size.logoMark as { w: number; h: number };
const scale = (S * 0.6) / w;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" fill="${c.accent}"/>
  <g transform="translate(${(S - w * scale) / 2} ${(S - h * scale) / 2}) scale(${scale})">
    <path d="${path}" fill="${c.ink}"/>
  </g>
</svg>`;

const dir = resolve(root, "ios/App/Assets.xcassets/AppIcon.appiconset");
mkdirSync(dir, { recursive: true });
sharp(Buffer.from(svg)).removeAlpha().png().toFile(resolve(dir, "AppIcon-1024.png")).then(() => console.log("wrote", dir)).catch((e) => { console.error(e); process.exit(1); });
writeFileSync(
  resolve(dir, "Contents.json"),
  JSON.stringify(
    {
      images: [{ filename: "AppIcon-1024.png", idiom: "universal", platform: "ios", size: "1024x1024" }],
      info: { author: "xcode", version: 1 },
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  resolve(root, "ios/App/Assets.xcassets/Contents.json"),
  JSON.stringify({ info: { author: "xcode", version: 1 } }, null, 2) + "\n",
);
