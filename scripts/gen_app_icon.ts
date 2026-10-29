/**
 * Renders the iOS app icon from design/tokens.json (no hand-drawn asset):
 * a lime tag with an ink outline and hard shadow on the green ground, with
 * Tag's camera dot. Output: ios/App/Assets.xcassets/AppIcon.appiconset/.
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

// Tag shape: a rounded rectangle with a cut corner and a hole, tilted like the wordmark.
const tag = (dx: number, dy: number, fill: string, stroke?: string) => `
  <g transform="translate(${512 + dx} ${512 + dy}) rotate(-12)">
    <path d="M -230 -300 L 150 -300 Q 230 -300 230 -220 L 230 230 Q 230 310 150 310 L -150 310 Q -230 310 -230 230 L -230 -150 Z"
      fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="28" stroke-linejoin="round"` : ""}/>
  </g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" fill="${c.ground}"/>
  ${tag(28, 34, c.inkDeep)}
  ${tag(0, 0, c.lime, c.ink)}
  <g transform="translate(512 512) rotate(-12)">
    <circle cx="-150" cy="-220" r="34" fill="${c.ground}" stroke="${c.ink}" stroke-width="22"/>
    <rect x="-120" y="20" width="240" height="170" rx="40" fill="${c.cream}" stroke="${c.ink}" stroke-width="22"/>
    <rect x="-40" y="-20" width="80" height="50" rx="14" fill="${c.ink}"/>
    <circle cx="0" cy="105" r="52" fill="${c.ink}"/>
    <circle cx="0" cy="105" r="26" fill="${c.lime}"/>
    <circle cx="80" cy="60" r="12" fill="${c.ink}"/>
  </g>
</svg>`;

const dir = resolve(root, "ios/App/Assets.xcassets/AppIcon.appiconset");
mkdirSync(dir, { recursive: true });
sharp(Buffer.from(svg)).removeAlpha().png().toFile(resolve(dir, "AppIcon-1024.png")).then(() => console.log("wrote", dir));
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
