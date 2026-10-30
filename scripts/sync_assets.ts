/**
 * Copies the design assets (design/assets/, listed in design/tokens.json `assets`) to both apps.
 *   web/public/assets/<file>                         as committed (PNG at 2x, SVG as exported)
 *   ios/App/Assets.xcassets/<name>.imageset/         PNG: <name>@2x.png (the file) + <name>.png (1x, sharp)
 *                                                     SVG: <name>.svg, vector kept; icons and the logo
 *                                                     render as templates (tinted by the view)
 *   ios/App/Info.plist UIAppFonts                    makes sure Inter-Variable.ttf is registered
 * GIFs dropped in design/assets/ stay GIF on the web and become APNG + MP4 for iOS
 * (ios/App/Resources/Animations/, needs ffmpeg). None exist yet.
 * Entries marked `pending` in tokens.json are skipped with a warning.
 * Run: pnpm assets
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { extname, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname ?? __dirname, "..");
const tokens = JSON.parse(readFileSync(resolve(root, "design/tokens.json"), "utf8"));
const src = resolve(root, "design/assets");
const webDir = resolve(root, "web/public/assets");
const xcassets = resolve(root, "ios/App/Assets.xcassets");
const fontFile = "Inter-Variable.ttf";
const fontDir = resolve(root, "ios/App/Resources/Fonts");
const infoPlist = resolve(root, "ios/App/Info.plist");

type AssetEntry = { file: string; node: string; template?: boolean; pending?: boolean };
const json = (o: unknown) => JSON.stringify(o, null, 2) + "\n";
const info = { author: "xcode", version: 1 };
const fail = (msg: string) => {
  console.error(`assets: ${msg}`);
  process.exit(1);
};

function nonEmpty(path: string) {
  if (!existsSync(path) || statSync(path).size === 0) fail(`missing or empty: ${path}`);
}

async function imageset(name: string, file: string, template: boolean) {
  const dir = resolve(xcassets, `${name}.imageset`);
  mkdirSync(dir, { recursive: true });
  const from = resolve(src, file);
  if (extname(file) === ".svg") {
    copyFileSync(from, resolve(dir, file));
    const properties: Record<string, unknown> = { "preserves-vector-representation": true };
    if (template) properties["template-rendering-intent"] = "template";
    writeFileSync(resolve(dir, "Contents.json"), json({ images: [{ filename: file, idiom: "universal" }], info, properties }));
    return;
  }
  // PNG committed at 2x: the 1x is half its size.
  const meta = await sharp(from).metadata();
  const x1 = `${name}.png`, x2 = `${name}@2x.png`;
  copyFileSync(from, resolve(dir, x2));
  await sharp(from)
    .resize(Math.round((meta.width ?? 2) / 2), Math.round((meta.height ?? 2) / 2))
    .png()
    .toFile(resolve(dir, x1));
  writeFileSync(
    resolve(dir, "Contents.json"),
    json({
      images: [
        { filename: x1, idiom: "universal", scale: "1x" },
        { filename: x2, idiom: "universal", scale: "2x" },
        { idiom: "universal", scale: "3x" },
      ],
      info,
    }),
  );
}

function gifs() {
  const list = readdirSync(src).filter((f) => extname(f).toLowerCase() === ".gif");
  if (list.length === 0) return;
  const out = resolve(root, "ios/App/Resources/Animations");
  mkdirSync(out, { recursive: true });
  for (const f of list) {
    const base = f.replace(/\.gif$/i, "");
    copyFileSync(resolve(src, f), resolve(webDir, f));
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", resolve(src, f), "-plays", "0", "-f", "apng", resolve(out, `${base}.png`)]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", resolve(src, f), "-movflags", "faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", resolve(out, `${base}.mp4`)]);
    console.log(`assets: ${f} -> web GIF, iOS APNG + MP4`);
  }
}

function registerFont() {
  nonEmpty(resolve(fontDir, fontFile));
  nonEmpty(resolve(fontDir, "OFL-Inter.txt"));
  const plist = readFileSync(infoPlist, "utf8");
  if (plist.includes(`<string>${fontFile}</string>`)) return;
  const m = plist.match(/<key>UIAppFonts<\/key>\s*<array>/);
  if (!m) fail("Info.plist has no UIAppFonts array");
  writeFileSync(infoPlist, plist.replace(m![0], `${m![0]}\n\t\t<string>${fontFile}</string>`));
  console.log(`assets: registered ${fontFile} in Info.plist`);
}

async function main() {
  mkdirSync(webDir, { recursive: true });
  const entries = Object.entries<AssetEntry>(tokens.assets ?? {});
  let copied = 0;
  for (const [key, a] of entries) {
    if (a.pending) {
      console.warn(`assets: ${key} (${a.file}, node ${a.node}) is pending; not exported from the Figma file yet`);
      continue;
    }
    const from = resolve(src, a.file);
    nonEmpty(from);
    copyFileSync(from, resolve(webDir, a.file));
    await imageset(a.file.replace(/\.[a-z0-9]+$/i, ""), a.file, a.template === true);
    copied++;
  }
  gifs();
  registerFont();
  console.log(`assets: ${copied} files -> web/public/assets and ios/App/Assets.xcassets`);
}

main().catch((e) => fail(String(e)));
