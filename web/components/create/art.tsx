"use client";
import { useEffect, useRef, useState, type Ref } from "react";
import { fmt, m } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button } from "@/components/ui/Button";
import { MicIcon, StopIcon } from "@/components/ui/Icons";
import { speak, stopSpeaking } from "@/components/speech";
import { ASSETS } from "@/lib/assets";
import { InfoCard } from "./cards";
import styles from "./Create.module.css";

/**
 * Art preview (Components `4021:4470`): the maker's art on a grey well with a white label chip
 * ("YOUR ART", "BEFORE", "AFTER"). The chip is visible text; the picture keeps its own alt, or ""
 * when the "What the image shows" card next to it describes it.
 */
export function ArtPreview({ label, src, alt, className }: { label: string; src: string | null | undefined; alt: string; className?: string }) {
  return (
    <figure className={[styles.artPreview, className].filter(Boolean).join(" ")}>
      <figcaption className={styles.artLabel}>{label}</figcaption>
      <ArtImage src={src} alt={alt} placeholder={m.common.imageMissing} ratio="auto" eager className={styles.artPreviewImg} />
    </figure>
  );
}

/**
 * The sticker-loading animation (Assets `4036:4404`, slot 342 × 342, radius 24): the muted, looped
 * MP4; under prefers-reduced-motion it stays on its first frame (no autoplay). Decorative: the
 * status line under it carries the meaning.
 */
export function StickerLoading() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (mq.matches) { v.pause(); v.currentTime = 0; return; }
      void v.play().catch(() => { /* autoplay refused: the first frame stays */ });
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return <video ref={ref} className={styles.stickerLoading} src={ASSETS.stickerLoadingVideo} muted loop playsInline preload="auto" aria-hidden="true" />;
}

/** Underlined text action, centred (44 px target). */
export function TextAction({ onClick, children, pressed }: { onClick: () => void; children: string; pressed?: boolean }) {
  return <Button variant="ghost" arrow={false} className={styles.textAction} aria-pressed={pressed} onClick={onClick}>{children}</Button>;
}

/** The 84 px record button with its visible label (Record button `2007:292`), and an optional "Type instead". */
export function RecordControl({ label, onClick, onType, disabled }: { label: string; onClick: () => void; onType?: () => void; disabled?: boolean }) {
  return (
    <div className={styles.recordWrap}>
      <button type="button" className={styles.record} onClick={onClick} aria-label={label} disabled={disabled}><MicIcon /></button>
      <span aria-hidden="true">{label}</span>
      {onType ? <TextAction onClick={onType}>{m.create.typeInstead}</TextAction> : null}
    </div>
  );
}

/**
 * Recording: the LISTENING card, the visible seconds, the green Stop button and "Type instead".
 * "Listening" is announced by the screen's persistent live region (Change it), not by this card.
 */
export function Listening({ seconds, onStop, onType, stopRef }: { seconds: number; onStop: () => void; onType: () => void; stopRef?: Ref<HTMLButtonElement> }) {
  return (
    <>
      <InfoCard eyebrow={m.create.speak.listening}><p>{m.create.speak.listeningHint}</p></InfoCard>
      <div className={styles.recordWrap}>
        <p className={styles.seconds}>{fmt(m.create.speak.seconds, { s: seconds })}</p>
        <button ref={stopRef} type="button" className={styles.record} data-recording="true" onClick={onStop} aria-label={m.create.speak.stop}><StopIcon /></button>
        <span aria-hidden="true">{m.create.speak.stop}</span>
        <TextAction onClick={onType}>{m.create.typeInstead}</TextAction>
      </div>
    </>
  );
}

/** "Hear what the image shows": reads `text` aloud with the browser voice; a second press stops it. */
export function useReadAloud() {
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  function toggle(text: string | null) {
    if (playing) { stopSpeaking(); setPlaying(false); return; }
    if (!text) return;
    setPlaying(true);
    speak(text, { onEnd: () => setPlaying(false) });
  }
  return { playing, toggle };
}
