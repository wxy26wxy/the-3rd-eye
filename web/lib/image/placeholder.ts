/**
 * Procedural images for offline mode (fixtures, seed without keys, the tote reference):
 * simple sticker-style subjects with bold outlines and flat colors on pure white.
 * Colors here are image content, not UI styling.
 */
import sharp from "sharp";

const PALETTE = ["#3bb273", "#f2c14e", "#e15554", "#4d9de0", "#7768ae", "#f78154"];
const SHAPES = ["flower", "star", "sun", "heart", "cloud", "fish"] as const;
export type PlaceholderShape = (typeof SHAPES)[number];

function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function star(cx: number, cy: number, r1: number, r2: number, n: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function shapeSvg(shape: PlaceholderShape, fill: string, accent: string): string {
  const stroke = `stroke="#1d1d1b" stroke-width="22" stroke-linejoin="round"`;
  switch (shape) {
    case "star":
      return `<polygon points="${star(512, 530, 330, 150, 5)}" fill="${fill}" ${stroke}/>`;
    case "sun":
      return `<polygon points="${star(512, 512, 360, 260, 12)}" fill="${accent}" ${stroke}/><circle cx="512" cy="512" r="200" fill="${fill}" ${stroke}/>`;
    case "heart":
      return `<path d="M512 830 C 180 600 160 330 340 270 C 440 240 500 300 512 360 C 524 300 584 240 684 270 C 864 330 844 600 512 830 Z" fill="${fill}" ${stroke}/>`;
    case "cloud":
      return `<path d="M300 700 C 170 700 150 540 270 510 C 260 380 420 330 490 420 C 540 300 760 320 750 480 C 880 480 900 700 740 700 Z" fill="${fill}" ${stroke}/>`;
    case "fish":
      return `<path d="M230 512 C 330 330 640 330 760 512 C 640 694 330 694 230 512 Z" fill="${fill}" ${stroke}/><polygon points="760,512 880,400 880,624" fill="${accent}" ${stroke}/><circle cx="380" cy="480" r="30" fill="#1d1d1b"/>`;
    case "flower":
    default: {
      const petals = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 6;
        return `<circle cx="${(512 + 190 * Math.cos(a)).toFixed(0)}" cy="${(512 + 190 * Math.sin(a)).toFixed(0)}" r="140" fill="${fill}" ${stroke}/>`;
      }).join("");
      return `${petals}<circle cx="512" cy="512" r="130" fill="${accent}" ${stroke}/>`;
    }
  }
}

/** A 1024×1024 PNG chosen deterministically from `seed` (or a given shape). */
export async function placeholderArt(seed: string, opts: { shape?: PlaceholderShape; size?: number } = {}): Promise<Buffer> {
  const h = seedOf(seed);
  const shape = opts.shape ?? SHAPES[h % SHAPES.length];
  const fill = PALETTE[(h >>> 3) % PALETTE.length];
  const accent = PALETTE[((h >>> 3) + 2) % PALETTE.length];
  const size = opts.size ?? 1024;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#ffffff"/>${shapeSvg(shape, fill, accent)}</svg>`;
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

/** Neutral canvas tote bag, front view, used as the mockup reference when no photo exists. */
export async function toteReference(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#eeeae4"/>
  <path d="M360 330 C 360 120 664 120 664 330" fill="none" stroke="#d9cfbf" stroke-width="38"/>
  <path d="M250 320 L 774 320 L 820 930 L 204 930 Z" fill="#efe6d6" stroke="#d2c6b2" stroke-width="6"/>
  <path d="M250 320 L 774 320 L 778 360 L 246 360 Z" fill="#e4d9c6"/>
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}
