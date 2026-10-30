/**
 * Copies the design assets (design/assets/, listed in design/tokens.json `assets`) to both apps.
 *   web/public/assets/<file>                         as committed (PNG at 2x, SVG as exported)
 *   ios/App/Assets.xcassets/<name>.imageset/         PNG: <name>@2x.png (the file) + <name>.png (1x, sharp)
 *                                                     SVG: <name>.svg, vector kept; icons and the logo
 *                                                     render as templates (tinted by the view)
 *   ios/App/Info.plist UIAppFonts                    makes sure Inter-Variable.ttf is registered
 * A GIF entry stays GIF on the web and becomes an MP4 (<name>.mp4, H.264, looped by the player) for
 * iOS in ios/App/Resources/Animations/ (needs ffmpeg; bit-exact flags keep reruns byte-identical).
 * No APNG: the Finding drawings GIF becomes a 12 MB APNG against a 0.15 MB MP4 (decision T100 fix 1).
 * Entries marked `pending` in tokens.json are skipped with a warning.
 * Outputs this script owns that no longer match a non-pending entry are deleted (web/public/assets/
 * files, *.imageset folders other than AppIcon, Resources/Animations files), so a rename or a
 * switch back to `pending` leaves nothing behind.
 * Run: pnpm assets
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
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

const animDir = resolve(root, "ios/App/Resources/Animations");

function gif(name: string, file: string) {
  mkdirSync(animDir, { recursive: true });
  const from = resolve(src, file);
  const exact = ["-y", "-loglevel", "error", "-i", from, "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:v", "+bitexact"];
  execFileSync("ffmpeg", [...exact, "-c:v", "libx264", "-threads", "1", "-movflags", "faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", resolve(animDir, `${name}.mp4`)]);
}

/** Deletes outputs of earlier runs that no current entry produces. Never touches AppIcon. */
function prune(names: Set<string>, files: Set<string>) {
  for (const f of existsSync(webDir) ? readdirSync(webDir) : []) if (!files.has(f)) rmSync(resolve(webDir, f), { recursive: true });
  for (const d of readdirSync(xcassets)) {
    if (!d.endsWith(".imageset")) continue;
    if (!names.has(d.replace(/\.imageset$/, ""))) rmSync(resolve(xcassets, d), { recursive: true });
  }
  for (const f of existsSync(animDir) ? readdirSync(animDir) : []) if (!names.has(f.replace(/\.mp4$/, "")) || !f.endsWith(".mp4")) rmSync(resolve(animDir, f));
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
  const live = entries.filter(([key, a]) => {
    if (a.pending) console.warn(`assets: ${key} (${a.file}, node ${a.node}) is pending; not exported from the Figma file yet`);
    return !a.pending;
  });
  const baseName = (file: string) => file.replace(/\.[a-z0-9]+$/i, "");
  prune(new Set(live.map(([, a]) => baseName(a.file))), new Set(live.map(([, a]) => a.file)));
  for (const [, a] of live) {
    const from = resolve(src, a.file);
    nonEmpty(from);
    copyFileSync(from, resolve(webDir, a.file));
    if (extname(a.file).toLowerCase() === ".gif") gif(baseName(a.file), a.file);
    else await imageset(baseName(a.file), a.file, a.template === true);
  }
  registerFont();
  console.log(`assets: ${live.length} files -> web/public/assets, ios/App/Assets.xcassets, ios/App/Resources/Animations`);
}

main().catch((e) => fail(String(e)));
