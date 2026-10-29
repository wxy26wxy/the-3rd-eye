/** Simple product glyphs for the choice cards (decorative). */
export function ProductGlyph({ type }: { type: "sticker" | "tote" }) {
  const common = { viewBox: "0 0 64 64", width: "1.6em", height: "1.6em", fill: "none", stroke: "currentColor", strokeWidth: 3.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const, "aria-hidden": true, focusable: false };
  if (type === "sticker") {
    return <svg {...common}><path d="M12 10h40v26L36 54H12z" /><path d="M36 54V36h16" /><circle cx="26" cy="26" r="3" /><circle cx="38" cy="26" r="3" /><path d="M24 36q8 6 16 0" /></svg>;
  }
  return <svg {...common}><path d="M10 22h44l-4 34H14z" /><path d="M22 22v-6a10 10 0 0 1 20 0v6" /><path d="M24 36q8 6 16 0" /></svg>;
}
