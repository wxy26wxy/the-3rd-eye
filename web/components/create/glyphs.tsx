import { ASSETS } from "@/lib/assets";
import styles from "./Create.module.css";

/** Product pictures for the choice cards (Sky Pick board): the reading mascot sticker and the tote photo. Decorative; the card title names the product. */
export function ProductGlyph({ type }: { type: "sticker" | "tote" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={type === "sticker" ? ASSETS.mascotBook : ASSETS.tote} alt="" className={[styles.glyph, type === "tote" ? styles.glyphTote : ""].filter(Boolean).join(" ")} />
  );
}
