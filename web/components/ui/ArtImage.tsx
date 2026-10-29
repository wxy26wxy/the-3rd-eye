import styles from "./ArtImage.module.css";

/**
 * Artwork and mockup images. Sources are Blob URLs on hosts that vary per store, so this
 * uses a plain <img> (lazy, async decode) instead of next/image remote patterns.
 * `alt` is required; pass "" only when an adjacent caption already describes the image.
 */
export function ArtImage({ src, alt, ratio = "square", fit = "contain", placeholder, eager, className }: {
  src: string | null | undefined; alt: string; ratio?: "square" | "portrait" | "wide" | "auto"; fit?: "contain" | "cover"; placeholder?: string; eager?: boolean; className?: string;
}) {
  const cls = [styles.frame, styles[ratio], className].filter(Boolean).join(" ");
  if (!src) {
    return (
      <div className={[cls, styles.empty].join(" ")} role="img" aria-label={alt || placeholder}>
        <span aria-hidden="true">{placeholder}</span>
      </div>
    );
  }
  return (
    <div className={cls}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" className={fit === "cover" ? styles.cover : styles.contain} />
    </div>
  );
}
