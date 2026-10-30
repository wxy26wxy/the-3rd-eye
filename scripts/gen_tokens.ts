/**
 * Generates platform token files from design/tokens.json.
 *   web/app/tokens.css          CSS custom properties (default + high-contrast)
 *   web/lib/brand.ts            brand name, wordmark and app URL scheme
 *   web/lib/assets.ts           logical asset name -> /assets/<file> (from tokens.assets)
 *   ios/App/Theme/Tokens.swift  Swift constants + Color/Font helpers (incl. Tokens.Brand, Tokens.Asset)
 * Run: pnpm tokens
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname ?? __dirname, "..");
const tokens = JSON.parse(readFileSync(resolve(root, "design/tokens.json"), "utf8"));

function deref(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const m = v.match(/^\{(.+)\}$/);
  if (!m) return v;
  return deref(m[1].split(".").reduce((o: any, k) => o?.[k], tokens));
}
const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

// ---------- CSS ----------
let css = `/* GENERATED from design/tokens.json — do not edit by hand. Run: pnpm tokens */\n:root {\n`;
for (const [k, v] of Object.entries(tokens.color)) css += `  --color-${kebab(k)}: ${v};\n`;
for (const [k, v] of Object.entries(tokens.semantic)) css += `  --${kebab(k)}: ${deref(v)};\n`;
css += `  --font-display: '${tokens.font.display.family}', ${tokens.font.display.fallback};\n`;
css += `  --font-body: '${tokens.font.body.family}', ${tokens.font.body.fallback};\n`;
css += `  --display-tilt: ${tokens.font.display.tilt};\n`;
for (const [k, v] of Object.entries<any>(tokens.type)) {
  css += `  --type-${kebab(k)}-size: ${v.size}px;\n`;
  if (v.lineHeight) css += `  --type-${kebab(k)}-lh: ${v.lineHeight};\n`;
  if (v.weight) css += `  --type-${kebab(k)}-weight: ${v.weight};\n`;
  if (v.letterSpacing) css += `  --type-${kebab(k)}-ls: ${v.letterSpacing};\n`;
}
for (const [k, v] of Object.entries(tokens.space)) css += `  --space-${k}: ${v}px;\n`;
for (const [k, v] of Object.entries(tokens.radius)) css += `  --radius-${kebab(k)}: ${v}px;\n`;
for (const [k, v] of Object.entries(tokens.border)) css += `  --border-${k}: ${v}px;\n`;
for (const [k, v] of Object.entries<any>(tokens.shadow)) css += `  --shadow-${kebab(k)}: ${v.x}px ${v.y}px ${v.blur}px ${deref(v.color)};\n`;
// Numbers are px; a string keeps its own unit (e.g. "65vh").
const cssSize = (v: unknown) => (typeof v === "number" ? `${v}px` : String(v));
// A {w, h} size (e.g. logoMark) becomes two properties: --size-logo-mark-w and --size-logo-mark-h.
const isWH = (v: unknown): v is { w: number; h: number } => typeof v === "object" && v !== null && "w" in v && "h" in v;
for (const [k, v] of Object.entries(tokens.size)) {
  if (isWH(v)) css += `  --size-${kebab(k)}-w: ${v.w}px;\n  --size-${kebab(k)}-h: ${v.h}px;\n`;
  else css += `  --size-${kebab(k)}: ${cssSize(v)};\n`;
}
for (const [k, v] of Object.entries(tokens.opacity ?? {})) css += `  --opacity-${kebab(k)}: ${v};\n`;
css += `  --grain-opacity: ${tokens.effects.grain.opacity};\n`;
css += `  --display-stroke: ${tokens.effects.displayStroke.width}px;\n  --display-shadow-y: ${tokens.effects.displayStroke.shadowY}px;\n`;
for (const [k, v] of Object.entries(tokens.motion)) css += `  --motion-${k}: ${typeof v === "number" ? v + "ms" : v};\n`;
css += `}\n\n@media (prefers-contrast: more) {\n  :root {\n`;
for (const [k, v] of Object.entries(tokens.highContrast)) css += `    --${kebab(k)}: ${v};\n`;
css += `    --grain-opacity: 0;\n  }\n}\n:root[data-contrast="high"] {\n`;
for (const [k, v] of Object.entries(tokens.highContrast)) css += `  --${kebab(k)}: ${v};\n`;
css += `  --grain-opacity: 0;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  :root { --motion-fast: 0ms; --motion-base: 0ms; --motion-slow: 0ms; }\n}\n`;
const cssOut = resolve(root, "web/app/tokens.css");
mkdirSync(dirname(cssOut), { recursive: true });
writeFileSync(cssOut, css);

// ---------- Brand (web) ----------
const brand = tokens.brand as { name: string; wordmark: string; scheme: string };
const brandOut = resolve(root, "web/lib/brand.ts");
mkdirSync(dirname(brandOut), { recursive: true });
writeFileSync(
  brandOut,
  `// GENERATED from design/tokens.json — do not edit by hand. Run: pnpm tokens\n` +
    `export const BRAND = { name: ${JSON.stringify(brand.name)}, wordmark: ${JSON.stringify(brand.wordmark)}, scheme: ${JSON.stringify(brand.scheme)} } as const;\n`,
);

// ---------- Assets (web) ----------
// tokens.assets maps a logical name to a file in design/assets/ (copied by `pnpm assets`). Pending
// entries (not exported from the Figma file yet) are left out so no code can reference a missing file.
type AssetEntry = { file: string; node: string; template?: boolean; pending?: boolean };
const assets = Object.entries<AssetEntry>(tokens.assets ?? {}).filter(([, a]) => !a.pending);
const assetName = (file: string) => file.replace(/\.[a-z0-9]+$/i, "");
const assetsOut = resolve(root, "web/lib/assets.ts");
writeFileSync(
  assetsOut,
  `// GENERATED from design/tokens.json — do not edit by hand. Run: pnpm tokens\n` +
    `// Files are served from web/public/assets/ (copied from design/assets/ by \`pnpm assets\`).\nexport const ASSETS = {\n` +
    assets.map(([k, a]) => `  ${k}: ${JSON.stringify(`/assets/${a.file}`)},\n`).join("") +
    `} as const;\n`,
);

// ---------- Swift ----------
// Accepts #RRGGBB and rgba(r,g,b,a) (e.g. color.scrim, shadow.soft).
const hexToSwift = (value: string) => {
  const rgba = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (rgba) {
    const [r, g, b] = [rgba[1], rgba[2], rgba[3]].map((n) => Number(n) / 255);
    const a = rgba[4] === undefined ? 1 : Number(rgba[4]);
    return `Color(red: ${r.toFixed(4)}, green: ${g.toFixed(4)}, blue: ${b.toFixed(4)}, opacity: ${a})`;
  }
  const h = value.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  return `Color(red: ${r.toFixed(4)}, green: ${g.toFixed(4)}, blue: ${b.toFixed(4)})`;
};
let swift = `// GENERATED from design/tokens.json — do not edit by hand. Run: pnpm tokens\nimport SwiftUI\n\nenum Tokens {\n  enum Brand {\n    static let name = ${JSON.stringify(brand.name)}\n    static let wordmark = ${JSON.stringify(brand.wordmark)}\n    static let scheme = ${JSON.stringify(brand.scheme)}\n  }\n  enum Palette {\n`;
for (const [k, v] of Object.entries<string>(tokens.color)) swift += `    static let ${k} = ${hexToSwift(v)}\n`;
swift += `  }\n  enum Semantic {\n`;
for (const [k, v] of Object.entries(tokens.semantic)) swift += `    static let ${k} = ${hexToSwift(deref(v) as string)}\n`;
swift += `  }\n  enum HighContrast {\n`;
for (const [k, v] of Object.entries<string>(tokens.highContrast)) swift += `    static let ${k} = ${hexToSwift(v)}\n`;
// `font.<role>.ios` is the name iOS registers for the bundled file (Inter's variable TTF registers
// as "Inter Variable"); without it the old rule applies (family without spaces + "-Regular").
const iosFont = (f: { family: string; ios?: string }, fallback: string) => f.ios ?? fallback;
swift += `  }\n  enum FontName {\n    static let display = "${iosFont(tokens.font.display, tokens.font.display.family.replace(/ /g, "") + "-Regular")}"\n    static let body = "${iosFont(tokens.font.body, tokens.font.body.family)}"\n  }\n  enum TypeScale {\n`;
for (const [k, v] of Object.entries<any>(tokens.type)) swift += `    static let ${k}: CGFloat = ${v.size}\n`;
swift += `  }\n  enum Space {\n`;
for (const [k, v] of Object.entries(tokens.space)) swift += `    static let ${k}: CGFloat = ${v}\n`;
swift += `  }\n  enum Radius {\n`;
for (const [k, v] of Object.entries(tokens.radius)) swift += `    static let ${k}: CGFloat = ${v}\n`;
swift += `  }\n  enum Border {\n`;
for (const [k, v] of Object.entries(tokens.border)) swift += `    static let ${k}: CGFloat = ${v}\n`;
swift += `  }\n  enum Size {\n`;
for (const [k, v] of Object.entries(tokens.size)) {
  const vh = typeof v === "string" ? v.match(/^([\d.]+)vh$/) : null;
  // A viewport-height size becomes a share of the screen height named `<key>Share` (65vh → photoMaxHeightShare = 0.65).
  if (vh) swift += `    /// Share of the screen height, not points (${v} on the web).\n    static let ${k}Share: CGFloat = ${Number(vh[1]) / 100}\n`;
  else if (isWH(v)) swift += `    static let ${k} = CGSize(width: ${v.w}, height: ${v.h})\n`;
  else swift += `    static let ${k}: CGFloat = ${v}\n`;
}
swift += `  }\n  enum Opacity {\n`;
for (const [k, v] of Object.entries(tokens.opacity ?? {})) swift += `    static let ${k}: Double = ${v}\n`;
swift += `  }\n  enum Shadow {\n`;
for (const [k, v] of Object.entries<any>(tokens.shadow)) swift += `    static let ${k} = (x: CGFloat(${v.x}), y: CGFloat(${v.y}), color: ${hexToSwift(deref(v.color) as string)})\n`;
// Blur stays out of the (x, y, color) tuple so ShadowToken in ios/App/Theme keeps its shape.
swift += `  }\n  enum ShadowBlur {\n`;
for (const [k, v] of Object.entries<any>(tokens.shadow)) swift += `    static let ${k}: CGFloat = ${v.blur ?? 0}\n`;
swift += `  }\n  enum Asset {\n`;
for (const [k, a] of assets) swift += `    static let ${k} = ${JSON.stringify(assetName(a.file))}\n`;
swift += `  }\n  static let displayTilt: Double = ${parseFloat(tokens.font.display.tilt)}\n  static let grainOpacity: Double = ${tokens.effects.grain.opacity}\n}\n`;
const swiftOut = resolve(root, "ios/App/Theme/Tokens.swift");
mkdirSync(dirname(swiftOut), { recursive: true });
writeFileSync(swiftOut, swift);
console.log("tokens: wrote", cssOut, brandOut, assetsOut, "and", swiftOut);
