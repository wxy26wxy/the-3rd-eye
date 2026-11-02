"use client";
import { useState } from "react";
import { fmt, m } from "@/components/messages";
import styles from "./Product.module.css";

export type GallerySlide =
  | { kind: "image"; src: string; fit: "contain" | "cover"; tone: "accent" | "white" | "soft" | "alt"; card?: boolean }
  | { kind: "tag"; text: string };

/**
 * Gallery (4011:4378 / 2019:2026): the main picture (40 px radius, "Comes with a story tag" pill) and a
 * row of thumbnails, each a button "Show image n of N" (the story tag one starts with its visible "Story
 * tag"; aria-pressed on the one shown). The main image
 * carries the product alt text; thumbnails are decorative inside their labelled buttons.
 */
export function Gallery({ slides, alt }: { slides: GallerySlide[]; alt: string }) {
  const [current, setCurrent] = useState(0);
  const slide = slides[current] ?? slides[0];
  if (!slide) return null;
  return (
    <div className={styles.gallery} role="group" aria-label={m.product.galleryLabel}>
      <div className={[styles.mainImage, styles[`tone_${slide.kind === "image" ? slide.tone : "soft"}`]].join(" ")}>
        <Slide slide={slide} alt={alt} main />
        {slide.kind === "image" ? <span className={styles.tagPill} aria-hidden="true"><span className={styles.dot} />{m.product.storyTagPill}</span> : null}
      </div>
      {slides.length > 1 ? (
        <ul role="list" className={styles.thumbs}>
          {slides.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className={[styles.thumb, styles[`tone_${s.kind === "image" ? s.tone : "soft"}`]].join(" ")}
                aria-label={fmt(s.kind === "tag" ? m.product.showTagImage : m.product.showImage, { n: i + 1, total: slides.length })}
                aria-pressed={i === current}
                onClick={() => setCurrent(i)}
              >
                <span className={styles.thumbInner} aria-hidden="true"><Slide slide={s} alt="" /></span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Slide({ slide, alt, main }: { slide: GallerySlide; alt: string; main?: boolean }) {
  if (slide.kind === "tag") {
    return (
      <span className={styles.tagSlide}>
        <span className={styles.tagPill + " " + styles.tagPillStatic}><span className={styles.dot} aria-hidden="true" />{main ? m.product.storyTagPill : m.product.storyTagShort}</span>
        {main ? <span className={styles.tagSlideText}>{slide.text}</span> : null}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={slide.src} alt={alt} loading={main ? "eager" : "lazy"} decoding="async" className={slide.fit === "cover" ? styles.slideCover : styles.slideContain} />;
  return slide.card ? <span className={styles.slideCard}>{img}</span> : img;
}
